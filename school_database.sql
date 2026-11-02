-- =============================================
-- School Database - MySQL Schema
-- Database Laboratory Course
-- =============================================

CREATE DATABASE IF NOT EXISTS school_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE school_db;

-- =============================================
-- Table: departments (گروه‌های آموزشی)
-- =============================================
CREATE TABLE departments (
    department_id   INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- Table: teachers (معلمان)
-- =============================================
CREATE TABLE teachers (
    teacher_id      INT AUTO_INCREMENT PRIMARY KEY,
    first_name      VARCHAR(50)  NOT NULL,
    last_name       VARCHAR(50)  NOT NULL,
    national_code   VARCHAR(10)  NOT NULL UNIQUE,
    phone           VARCHAR(15),
    email           VARCHAR(100),
    department_id   INT,
    hire_date       DATE NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- Add head_teacher reference after teachers table exists
ALTER TABLE departments
    ADD COLUMN head_teacher_id INT,
    ADD FOREIGN KEY (head_teacher_id) REFERENCES teachers(teacher_id)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================
-- Table: students (دانش‌آموزان)
-- =============================================
CREATE TABLE students (
    student_id      INT AUTO_INCREMENT PRIMARY KEY,
    first_name      VARCHAR(50)  NOT NULL,
    last_name       VARCHAR(50)  NOT NULL,
    national_code   VARCHAR(10)  NOT NULL UNIQUE,
    phone           VARCHAR(15),
    email           VARCHAR(100),
    date_of_birth   DATE,
    grade_level     TINYINT NOT NULL COMMENT 'پایه تحصیلی (1-12)',
    enrollment_date DATE NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- Table: courses (دروس)
-- =============================================
CREATE TABLE courses (
    course_id       INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    course_code     VARCHAR(10)  NOT NULL UNIQUE,
    department_id   INT,
    credits         TINYINT NOT NULL DEFAULT 1,
    description     TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- =============================================
-- Table: classrooms (کلاس‌ها)
-- =============================================
CREATE TABLE classrooms (
    classroom_id    INT AUTO_INCREMENT PRIMARY KEY,
    building        VARCHAR(50)  NOT NULL,
    room_number     VARCHAR(10)  NOT NULL,
    capacity        INT NOT NULL DEFAULT 30,
    has_projector   BOOLEAN DEFAULT FALSE,
    UNIQUE (building, room_number)
);

-- =============================================
-- Table: classes (کلاس‌های درسی - ارتباط درس، معلم، زمان)
-- =============================================
CREATE TABLE classes (
    class_id        INT AUTO_INCREMENT PRIMARY KEY,
    course_id       INT NOT NULL,
    teacher_id      INT NOT NULL,
    classroom_id    INT,
    semester        ENUM('first', 'second', 'summer') NOT NULL COMMENT 'نیمسال',
    academic_year   VARCHAR(9) NOT NULL COMMENT 'سال تحصیلی مثلا 1403-1404',
    schedule_day    ENUM('Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday') NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    max_students    INT DEFAULT 30,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id)    REFERENCES courses(course_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (teacher_id)   REFERENCES teachers(teacher_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (classroom_id) REFERENCES classrooms(classroom_id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- =============================================
-- Table: enrollments (ثبت‌نام دانش‌آموز در کلاس)
-- =============================================
CREATE TABLE enrollments (
    enrollment_id   INT AUTO_INCREMENT PRIMARY KEY,
    student_id      INT NOT NULL,
    class_id        INT NOT NULL,
    enrollment_date DATE NOT NULL,
    status          ENUM('active', 'dropped', 'completed') DEFAULT 'active',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, class_id),
    FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (class_id)   REFERENCES classes(class_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- =============================================
-- Table: grades (نمرات)
-- =============================================
CREATE TABLE grades (
    grade_id        INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id   INT NOT NULL,
    grade_type      ENUM('midterm', 'final', 'quiz', 'assignment', 'project') NOT NULL
                    COMMENT 'نوع نمره: میانترم، پایانترم، کوییز، تکلیف، پروژه',
    score           DECIMAL(5,2) NOT NULL,
    max_score       DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    grade_date      DATE NOT NULL,
    description     VARCHAR(200),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(enrollment_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CHECK (score >= 0 AND score <= max_score)
);

-- =============================================
-- Table: attendance (حضور و غیاب)
-- =============================================
CREATE TABLE attendance (
    attendance_id   INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id   INT NOT NULL,
    attendance_date DATE NOT NULL,
    status          ENUM('present', 'absent', 'late', 'excused') NOT NULL
                    COMMENT 'حاضر، غایب، تأخیر، موجه',
    note            VARCHAR(200),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (enrollment_id, attendance_date),
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(enrollment_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- =============================================
-- Table: parents (والدین)
-- =============================================
CREATE TABLE parents (
    parent_id       INT AUTO_INCREMENT PRIMARY KEY,
    first_name      VARCHAR(50)  NOT NULL,
    last_name       VARCHAR(50)  NOT NULL,
    national_code   VARCHAR(10)  NOT NULL UNIQUE,
    phone           VARCHAR(15)  NOT NULL,
    email           VARCHAR(100),
    relationship    ENUM('father', 'mother', 'guardian') NOT NULL
                    COMMENT 'پدر، مادر، سرپرست',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- Table: student_parents (ارتباط دانش‌آموز - والدین)
-- =============================================
CREATE TABLE student_parents (
    student_id  INT NOT NULL,
    parent_id   INT NOT NULL,
    PRIMARY KEY (student_id, parent_id),
    FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (parent_id)  REFERENCES parents(parent_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);


-- =============================================
-- SAMPLE DATA (داده‌های نمونه)
-- =============================================

-- Departments
INSERT INTO departments (name) VALUES
('ریاضی و فیزیک'),
('علوم تجربی'),
('ادبیات و زبان'),
('علوم اجتماعی'),
('تربیت بدنی');

-- Teachers
INSERT INTO teachers (first_name, last_name, national_code, phone, email, department_id, hire_date) VALUES
('علی',     'احمدی',    '0012345678', '09121234567', 'ahmadi@school.ir',    1, '2015-09-01'),
('مریم',    'رضایی',    '0023456789', '09132345678', 'rezaei@school.ir',    1, '2018-09-01'),
('حسن',     'محمدی',    '0034567890', '09143456789', 'mohammadi@school.ir', 2, '2016-09-01'),
('فاطمه',   'حسینی',    '0045678901', '09154567890', 'hosseini@school.ir',  3, '2019-09-01'),
('رضا',     'کریمی',    '0056789012', '09165678901', 'karimi@school.ir',    4, '2017-09-01'),
('زهرا',    'موسوی',    '0067890123', '09176789012', 'mousavi@school.ir',   5, '2020-09-01');

-- Update department heads
UPDATE departments SET head_teacher_id = 1 WHERE department_id = 1;
UPDATE departments SET head_teacher_id = 3 WHERE department_id = 2;
UPDATE departments SET head_teacher_id = 4 WHERE department_id = 3;
UPDATE departments SET head_teacher_id = 5 WHERE department_id = 4;
UPDATE departments SET head_teacher_id = 6 WHERE department_id = 5;

-- Students
INSERT INTO students (first_name, last_name, national_code, phone, date_of_birth, grade_level, enrollment_date) VALUES
('امیر',    'نوری',     '1012345678', '09191234567', '2008-03-15', 10, '2023-09-01'),
('سارا',    'جعفری',    '1023456789', '09192345678', '2008-07-22', 10, '2023-09-01'),
('محمد',    'عباسی',    '1034567890', '09193456789', '2007-11-08', 11, '2022-09-01'),
('نرگس',    'صادقی',    '1045678901', '09194567890', '2007-05-30', 11, '2022-09-01'),
('حسین',    'طاهری',    '1056789012', '09195678901', '2006-01-12', 12, '2021-09-01'),
('مینا',    'قاسمی',    '1067890123', '09196789012', '2006-09-03', 12, '2021-09-01'),
('سینا',    'بهرامی',   '1078901234', '09197890123', '2008-12-19', 10, '2023-09-01'),
('الهه',    'شریفی',    '1089012345', '09198901234', '2007-04-25', 11, '2022-09-01');

-- Parents
INSERT INTO parents (first_name, last_name, national_code, phone, relationship) VALUES
('اکبر',    'نوری',     '2012345678', '09121111111', 'father'),
('مهناز',   'نوری',     '2023456789', '09122222222', 'mother'),
('رضا',     'جعفری',    '2034567890', '09123333333', 'father'),
('حمید',    'عباسی',    '2045678901', '09124444444', 'father'),
('مرضیه',   'صادقی',    '2056789012', '09125555555', 'mother'),
('کاظم',    'طاهری',    '2067890123', '09126666666', 'father');

-- Student-Parent relationships
INSERT INTO student_parents (student_id, parent_id) VALUES
(1, 1), (1, 2),
(2, 3),
(3, 4),
(4, 5),
(5, 6),
(6, 6);

-- Courses
INSERT INTO courses (name, course_code, department_id, credits, description) VALUES
('ریاضی ۱',        'MATH101', 1, 3, 'ریاضیات پایه دهم'),
('فیزیک ۱',        'PHYS101', 1, 3, 'فیزیک پایه دهم'),
('شیمی ۱',         'CHEM101', 2, 3, 'شیمی پایه دهم'),
('زیست‌شناسی ۱',    'BIO101',  2, 3, 'زیست‌شناسی پایه دهم'),
('ادبیات فارسی',    'LIT101',  3, 2, 'ادبیات فارسی پایه دهم'),
('زبان انگلیسی',    'ENG101',  3, 2, 'زبان انگلیسی پایه دهم'),
('تاریخ',           'HIS101',  4, 2, 'تاریخ معاصر'),
('تربیت بدنی',      'PE101',   5, 1, 'تربیت بدنی عمومی'),
('ریاضی ۲',        'MATH201', 1, 3, 'ریاضیات پایه یازدهم'),
('فیزیک ۲',        'PHYS201', 1, 3, 'فیزیک پایه یازدهم');

-- Classrooms
INSERT INTO classrooms (building, room_number, capacity, has_projector) VALUES
('ساختمان اصلی', '101', 30, TRUE),
('ساختمان اصلی', '102', 30, TRUE),
('ساختمان اصلی', '103', 25, FALSE),
('ساختمان اصلی', '201', 35, TRUE),
('آزمایشگاه',    'L01', 20, TRUE),
('سالن ورزش',    'G01', 50, FALSE);

-- Classes
INSERT INTO classes (course_id, teacher_id, classroom_id, semester, academic_year, schedule_day, start_time, end_time) VALUES
(1, 1, 1, 'first', '1403-1404', 'Saturday',  '08:00', '09:30'),
(2, 2, 2, 'first', '1403-1404', 'Sunday',    '08:00', '09:30'),
(3, 3, 5, 'first', '1403-1404', 'Monday',    '08:00', '09:30'),
(5, 4, 3, 'first', '1403-1404', 'Saturday',  '10:00', '11:30'),
(6, 4, 3, 'first', '1403-1404', 'Tuesday',   '08:00', '09:30'),
(7, 5, 4, 'first', '1403-1404', 'Wednesday', '08:00', '09:30'),
(8, 6, 6, 'first', '1403-1404', 'Thursday',  '08:00', '09:30'),
(9, 1, 1, 'first', '1403-1404', 'Sunday',    '10:00', '11:30'),
(10,2, 2, 'first', '1403-1404', 'Monday',    '10:00', '11:30');

-- Enrollments
INSERT INTO enrollments (student_id, class_id, enrollment_date, status) VALUES
(1, 1, '2024-09-01', 'active'),
(1, 2, '2024-09-01', 'active'),
(1, 3, '2024-09-01', 'active'),
(1, 4, '2024-09-01', 'active'),
(2, 1, '2024-09-01', 'active'),
(2, 2, '2024-09-01', 'active'),
(2, 5, '2024-09-01', 'active'),
(3, 8, '2024-09-01', 'active'),
(3, 9, '2024-09-01', 'active'),
(4, 8, '2024-09-01', 'active'),
(5, 6, '2024-09-01', 'active'),
(5, 7, '2024-09-01', 'active'),
(7, 1, '2024-09-01', 'active'),
(7, 3, '2024-09-01', 'active'),
(8, 8, '2024-09-01', 'active');

-- Grades
INSERT INTO grades (enrollment_id, grade_type, score, max_score, grade_date) VALUES
(1,  'midterm',    16.50, 20, '2024-11-01'),
(1,  'final',      18.00, 20, '2025-01-15'),
(2,  'midterm',    14.00, 20, '2024-11-02'),
(2,  'quiz',        8.50, 10, '2024-10-15'),
(3,  'midterm',    17.25, 20, '2024-11-03'),
(4,  'assignment', 19.00, 20, '2024-10-20'),
(5,  'midterm',    15.75, 20, '2024-11-01'),
(5,  'final',      17.00, 20, '2025-01-15'),
(7,  'midterm',    12.00, 20, '2024-11-05'),
(8,  'midterm',    19.50, 20, '2024-11-04'),
(9,  'final',      16.00, 20, '2025-01-16'),
(13, 'midterm',    13.50, 20, '2024-11-01'),
(14, 'quiz',        7.00, 10, '2024-10-18');

-- Attendance
INSERT INTO attendance (enrollment_id, attendance_date, status) VALUES
(1, '2024-09-07', 'present'),
(1, '2024-09-14', 'present'),
(1, '2024-09-21', 'absent'),
(1, '2024-09-28', 'present'),
(2, '2024-09-08', 'present'),
(2, '2024-09-15', 'late'),
(5, '2024-09-07', 'present'),
(5, '2024-09-14', 'present'),
(7, '2024-09-10', 'excused'),
(8, '2024-09-08', 'present'),
(8, '2024-09-15', 'absent');


-- =============================================
-- USEFUL VIEWS (ویوهای کاربردی)
-- =============================================

-- View: Student report card (کارنامه دانش‌آموز)
CREATE VIEW student_report_card AS
SELECT
    s.student_id,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
    s.grade_level,
    c.name AS course_name,
    c.credits,
    g.grade_type,
    g.score,
    g.max_score,
    ROUND((g.score / g.max_score) * 20, 2) AS normalized_score,
    cl.academic_year,
    cl.semester
FROM students s
JOIN enrollments e  ON s.student_id  = e.student_id
JOIN classes cl     ON e.class_id    = cl.class_id
JOIN courses c      ON cl.course_id  = c.course_id
LEFT JOIN grades g  ON e.enrollment_id = g.enrollment_id;

-- View: Attendance summary (خلاصه حضور و غیاب)
CREATE VIEW attendance_summary AS
SELECT
    s.student_id,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
    c.name AS course_name,
    COUNT(CASE WHEN a.status = 'present' THEN 1 END) AS present_count,
    COUNT(CASE WHEN a.status = 'absent'  THEN 1 END) AS absent_count,
    COUNT(CASE WHEN a.status = 'late'    THEN 1 END) AS late_count,
    COUNT(CASE WHEN a.status = 'excused' THEN 1 END) AS excused_count,
    COUNT(a.attendance_id) AS total_sessions
FROM students s
JOIN enrollments e  ON s.student_id  = e.student_id
JOIN classes cl     ON e.class_id    = cl.class_id
JOIN courses c      ON cl.course_id  = c.course_id
LEFT JOIN attendance a ON e.enrollment_id = a.enrollment_id
GROUP BY s.student_id, s.first_name, s.last_name, c.name;

-- View: Class roster (لیست کلاس)
CREATE VIEW class_roster AS
SELECT
    cl.class_id,
    c.name AS course_name,
    CONCAT(t.first_name, ' ', t.last_name) AS teacher_name,
    cl.schedule_day,
    cl.start_time,
    cl.end_time,
    cr.building,
    cr.room_number,
    COUNT(e.enrollment_id) AS enrolled_students
FROM classes cl
JOIN courses c      ON cl.course_id    = c.course_id
JOIN teachers t     ON cl.teacher_id   = t.teacher_id
LEFT JOIN classrooms cr ON cl.classroom_id = cr.classroom_id
LEFT JOIN enrollments e ON cl.class_id     = e.class_id AND e.status = 'active'
GROUP BY cl.class_id, c.name, t.first_name, t.last_name,
         cl.schedule_day, cl.start_time, cl.end_time, cr.building, cr.room_number;


-- =============================================
-- USEFUL QUERIES (کوئری‌های نمونه)
-- =============================================

-- 1. کارنامه یک دانش‌آموز خاص
-- SELECT * FROM student_report_card WHERE student_id = 1;

-- 2. میانگین نمرات هر درس
-- SELECT course_name, ROUND(AVG(score), 2) AS avg_score
-- FROM student_report_card
-- WHERE grade_type = 'final'
-- GROUP BY course_name;

-- 3. دانش‌آموزانی که بیش از ۲ غیبت دارند
-- SELECT student_name, course_name, absent_count
-- FROM attendance_summary
-- WHERE absent_count > 2;

-- 4. تعداد دانش‌آموزان هر کلاس
-- SELECT * FROM class_roster ORDER BY enrolled_students DESC;
