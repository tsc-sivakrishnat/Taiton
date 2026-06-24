Enterprise CPanel API (cpanel-be)

1. Create database and import schema:
   mysql -u USER -p DATABASE < database/enterprise_adm.sql

2. Copy .env.example to .env and set DB_* and JWT_SECRET.

3. npm install && npm run seed:demo

4. npm run dev

Support tickets: POST/GET /api/support/tickets (auth). Configure SMTP in .env for email (see .env.example). Import database/enterprise_adm.sql for tb_csd_support_* tables.

API base: http://127.0.0.1:8787/api
