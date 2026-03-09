-- CSA App Database Schema
-- Run via: npm run db:setup

-- Gift categories (static reference data)
CREATE TABLE IF NOT EXISTS gift_categories (
  id                    INT PRIMARY KEY AUTO_INCREMENT,
  sort_order            INT NOT NULL,
  name                  VARCHAR(100) NOT NULL,
  short_name            VARCHAR(50)  NOT NULL,
  core_struggle         TEXT NOT NULL,
  natural_state_label   TEXT NOT NULL,
  spiritual_state_label TEXT NOT NULL,
  natural_description   TEXT,
  spiritual_description TEXT
);

-- Groups
CREATE TABLE IF NOT EXISTS `groups` (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  role          ENUM('superadmin', 'group_admin', 'user') NOT NULL DEFAULT 'user',
  group_id      INT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE SET NULL
);

-- Assessments
CREATE TABLE IF NOT EXISTS assessments (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT NOT NULL,
  notes      TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Assessment responses (one per gift category per assessment)
CREATE TABLE IF NOT EXISTS assessment_responses (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  assessment_id    INT NOT NULL,
  gift_category_id INT NOT NULL,
  score            TINYINT NOT NULL,
  note             TEXT NULL,
  CONSTRAINT chk_score CHECK (score >= 1 AND score <= 10),
  UNIQUE KEY uq_assessment_category (assessment_id, gift_category_id),
  FOREIGN KEY (assessment_id)    REFERENCES assessments(id)    ON DELETE CASCADE,
  FOREIGN KEY (gift_category_id) REFERENCES gift_categories(id)
);
