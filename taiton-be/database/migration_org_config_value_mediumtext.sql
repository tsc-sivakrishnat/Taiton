-- Logo URLs may be long data: URLs (base64). MySQL TEXT (~64KB) truncates them and
-- the browser then fails with net::ERR_INVALID_URL. MEDIUMTEXT holds up to ~16MB.
ALTER TABLE `tb_config_org_config`
  MODIFY COLUMN `config_value` MEDIUMTEXT NOT NULL;
