CREATE DATABASE IF NOT EXISTS easybill
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'easybill'@'localhost'
  IDENTIFIED BY 'easybill_dev_123';

GRANT ALL PRIVILEGES ON easybill.* TO 'easybill'@'localhost';
FLUSH PRIVILEGES;
