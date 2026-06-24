import assert from 'assert';

const API_BASE = 'http://localhost:8787/api';

async function run() {
  console.log('Starting system endpoints validation test...');

  // 1. Authenticate as Platform Administrator
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rakesht@techtrole.com', password: 'Admin@123' })
  });
  
  assert.strictEqual(loginRes.status, 200, 'Login failed');
  const loginData = await loginRes.json();
  const token = loginData.token;
  assert.ok(token, 'No token returned');
  console.log('✔ Authenticated as Platform Administrator (rakesht@techtrole.com).');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Create Organization
  const orgCode = `TST_${Date.now().toString().slice(-6)}`;
  const orgName = `Verification Org ${Date.now()}`;
  const createOrgRes = await fetch(`${API_BASE}/platform/organizations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: orgCode, name: orgName })
  });
  assert.strictEqual(createOrgRes.status, 201, 'Organization creation failed');
  const orgData = await createOrgRes.json();
  const orgId = orgData.organization.id;
  assert.ok(orgId, 'Organization ID missing');
  console.log(`✔ Created Organization with code: ${orgCode}, ID: ${orgId}`);

  // 3. Duplicate Org Code Validation check
  const duplicateOrgRes = await fetch(`${API_BASE}/platform/organizations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: orgCode, name: 'Different Name' })
  });
  assert.strictEqual(duplicateOrgRes.status, 409, 'Duplicate org code did not return 409');
  console.log('✔ Duplicate Organization Code validation returned 409 Conflict correctly.');

  // 4. Create Org Roles and test Priority Uniqueness
  const roleCode1 = 'test_role_one';
  const createRole1Res = await fetch(`${API_BASE}/platform/organizations/${orgId}/roles`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: roleCode1, name: 'Test Role One', priority: 15, description: 'Desc' })
  });
  assert.strictEqual(createRole1Res.status, 201, 'Failed to create Role One');
  console.log('✔ Created Role One with priority 15.');

  // Try to create another role with the same priority (15)
  const createRole2Res = await fetch(`${API_BASE}/platform/organizations/${orgId}/roles`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: 'test_role_two', name: 'Test Role Two', priority: 15, description: 'Desc' })
  });
  assert.strictEqual(createRole2Res.status, 409, 'Duplicate role priority did not return 409');
  console.log('✔ Duplicate Role priority constraint returned 409 Conflict correctly.');

  // 5. Create Nav Item and test Label Uniqueness
  const navItemRes = await fetch(`${API_BASE}/platform/organizations/${orgId}/nav`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      label: 'Unique Test Menu',
      route: '/app/test-route',
      icon: 'Circle',
      position: 'top',
      sortOrder: 1,
      rolesCsv: 'org_admin',
      isActive: true
    })
  });
  assert.strictEqual(navItemRes.status, 200, 'Nav item creation failed');
  const navItemData = await navItemRes.json();
  const navId = navItemData.item.id;
  assert.ok(navId, 'Nav ID missing');
  console.log(`✔ Created Navigation item "Unique Test Menu", ID: ${navId}`);

  // Try duplicate nav item label under the same org
  const duplicateNavRes = await fetch(`${API_BASE}/platform/organizations/${orgId}/nav`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      label: 'Unique Test Menu',
      route: '/app/different-route',
      icon: 'Circle',
      position: 'top',
      sortOrder: 2,
      rolesCsv: 'org_admin',
      isActive: true
    })
  });
  assert.strictEqual(duplicateNavRes.status, 409, 'Duplicate nav label did not return 409');
  console.log('✔ Duplicate Navigation Item Label check returned 409 Conflict correctly.');

  // 6. Test User Registration Duplicate Mobile checks
  // Create first user
  const email1 = `user1_${Date.now().toString().slice(-6)}@test.com`;
  const mobileNumber = '9876543210';
  const user1Res = await fetch(`${API_BASE}/platform/organizations/${orgId}/org-admin`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: email1,
      fullName: 'User One',
      mobile: mobileNumber
    })
  });
  if (user1Res.status !== 201) {
    const errorBody = await user1Res.json();
    console.error('User One registration failed response:', errorBody);
  }
  assert.strictEqual(user1Res.status, 201, 'User One registration failed');
  const user1Data = await user1Res.json();
  const userId = user1Data.user.id;
  console.log(`✔ Registered User One (org_admin) with mobile: ${mobileNumber}, ID: ${userId}`);

  // Try to register another user with the SAME mobile number in the same org
  const email2 = `user2_${Date.now().toString().slice(-6)}@test.com`;
  const user2Res = await fetch(`${API_BASE}/platform/organizations/${orgId}/org-admin`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: email2,
      fullName: 'User Two',
      mobile: mobileNumber
    })
  });
  assert.strictEqual(user2Res.status, 409, 'Duplicate mobile did not return 409');
  console.log('✔ Duplicate Mobile number registration block returned 409 Conflict correctly.');

  // 7. Verify Hard Delete Deletions
  // Delete Nav Item
  const deleteNavRes = await fetch(`${API_BASE}/platform/organizations/${orgId}/nav/${navId}`, {
    method: 'DELETE',
    headers
  });
  assert.strictEqual(deleteNavRes.status, 200, 'Nav deletion failed');
  console.log('✔ Executed delete request on Nav Item.');

  // Verify Nav Item is hard deleted
  const getNavListRes = await fetch(`${API_BASE}/platform/organizations/${orgId}/nav`, {
    method: 'GET',
    headers
  });
  const navListData = await getNavListRes.json();
  const navExists = navListData.items.some(i => i.id === navId);
  assert.strictEqual(navExists, false, 'Deleted Nav Item still exists (not hard deleted)');
  console.log('✔ Nav Item verified hard-deleted from database (not present in list).');

  // Delete User
  const deleteUserRes = await fetch(`${API_BASE}/platform/organizations/${orgId}/org-admins/${userId}`, {
    method: 'DELETE',
    headers
  });
  assert.strictEqual(deleteUserRes.status, 200, 'User deletion failed');
  console.log('✔ Executed delete request on Org Admin User.');

  // Verify User is hard deleted
  const getAdminsRes = await fetch(`${API_BASE}/platform/organizations/${orgId}/org-admins`, {
    method: 'GET',
    headers
  });
  const adminsData = await getAdminsRes.json();
  const userExists = adminsData.admins.some(u => u.id === userId);
  assert.strictEqual(userExists, false, 'Deleted User still exists (not hard deleted)');
  console.log('✔ User verified hard-deleted from database (not present in list).');

  // Delete Role
  const deleteRoleRes = await fetch(`${API_BASE}/platform/organizations/${orgId}/roles/${roleCode1}`, {
    method: 'DELETE',
    headers
  });
  assert.strictEqual(deleteRoleRes.status, 200, 'Role deletion failed');
  console.log('✔ Executed delete request on Org Role.');

  // Verify Role is hard deleted
  const getRolesRes = await fetch(`${API_BASE}/platform/organizations/${orgId}/roles`, {
    method: 'GET',
    headers
  });
  const rolesData = await getRolesRes.json();
  const roleExists = rolesData.roles.some(r => r.code === roleCode1);
  assert.strictEqual(roleExists, false, 'Deleted Role still exists (not hard deleted)');
  console.log('✔ Role verified hard-deleted from database (not present in list).');

  console.log('\n=======================================');
  console.log('ALL API ENDPOINT LOGICAL CHECKS PASSED.');
  console.log('=======================================');
}

run().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
