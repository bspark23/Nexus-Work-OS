# Work Hub Pro

Company Work Management System (Version 2)

Build a modern, scalable, enterprise-grade Company Work Management System for internal company use.

The system should be similar in quality and user experience to ClickUp, Monday.com, Jira, Linear, or Notion, with a beautiful modern UI, smooth animations, responsive design, and live shared data.

This application will be used by every employee in the company to manage projects, daily work, reports, and assigned tasks while allowing management to monitor progress across every department.

The application must use a persistent database so every user's data is saved and synchronized in real time. Do not use mock data, local storage, or temporary in-memory data.

User Roles

Super Admin

The Super Admin has full access to the entire system.

The Super Admin can:

View every employee

View every department

View every project

View every report

View every task

View analytics

Add departments

Edit departments

Delete departments

Activate users

Suspend users

Search everything

Filter everything

Manage users

Manage projects

View company-wide progress

View department performance

View employee performance

The Super Admin dashboard should provide a complete overview of the company.

Employee

Employees can only access their own dashboard.

Employees can:

Update profile

Create projects

Update projects

Submit reports

Manage assigned tasks

Upload screenshots

Upload files

Update project progress

Employees cannot view another employee's private dashboard.

Authentication

Create a modern authentication system.

Registration Fields

Full Name

Username

Email

Department

Password

Confirm Password

Department should be selected from a dropdown.

Default Departments

Web Development

Video Team

Graphic Design Team

Social Media Team

The Super Admin can create additional departments.

Any department created by the Super Admin should automatically appear in the registration form.

Login

Login using

Username

Password

Example

Username:

Blessing2008

Password:

After login

If Super Admin

→ Open Admin Dashboard

If Employee

→ Open Employee Dashboard

Existing Employee

The current employee

Username:

Blessing2008

belongs to

Web Development

All existing projects currently assigned to Blessing2008 should belong under the Web Development department.

Employee Dashboard

If a new employee logs in and has no projects,

display

"You have not added any projects yet."

Display a large

Add New Project

button.

Navigation

The application should have a beautiful responsive sidebar on desktop.

On mobile,

replace the sidebar with a professional slide-out navigation drawer.

Navigation Items

Dashboard

Projects

Tasks

Reports

Activity

Profile

Settings

Logout

Admin users should additionally see

Departments

Employees

Analytics

Company Reports

Admin Panel

Projects

Employees can create projects.

Project Fields

Project Title

Project Type

Project Description

Department

Start Date

Expected Completion Date

Priority

Status

Progress Percentage

Current Task

Completed Tasks

Challenges

Reason for Delay

Developer Notes

Project Links

GitHub Repository

Live URL

Screenshots

Attachments

All fields are required where applicable.

Project Status

Status options

Not Started

In Progress

Blocked

Under Review

Completed

Automatically organize projects into their corresponding sections.

Each section should display modern cards with progress bars.

Status colors

Gray

Blue

Red

Orange

Green

Reports Module

Create a dedicated Reports section.

Employees can submit reports.

Report Types

Daily Report

Weekly Report

Monthly Report

The employee selects the report type from a dropdown.

Each report includes

Title

Summary

Completed Work

Challenges

Achievements

Next Steps

Date

Attachments

Status

After submission,

the report should automatically become visible to the Super Admin.

The Super Admin can open any report and review it.

The Super Admin should also be able to filter reports by

Employee

Department

Date

Week

Month

Report Type

Tasks Module

Create a complete Task Management module.

Employees can create their own tasks or record tasks assigned to them.

Task Fields

Task Title

Task Description

Priority

Status

Due Date

Assigned By

Department

Notes

Status Options

Pending

In Progress

Blocked

Done

Assigned By should be a searchable dropdown that automatically lists every registered user in the system.

Example

Assigned By

John Doe

Mary James

Blessing Adaoma

etc.

Once the task is created,

employees can continuously update the task until it is completed.

The Super Admin can view every task in the company.

Activity Timeline

Every action should generate an activity log.

Examples

Created project

Updated project

Submitted report

Completed task

Changed project status

Uploaded screenshot

Display activities in timeline format.

Department Management

The Super Admin can

Create Department

Edit Department

Delete Department

Open Department

Inside each department,

display

Total Employees

Projects

Completed Projects

Blocked Projects

Reports Submitted

Tasks Completed

Overall Department Progress

Employee List

Employee Directory

Create an employee directory.

Each employee profile should display

Photo

Full Name

Username

Email

Department

Projects

Reports

Tasks

Recent Activity

Current Status

Dashboard Analytics

The Admin Dashboard should display

Total Employees

Total Departments

Total Projects

Completed Projects

Projects In Progress

Blocked Projects

Reports Submitted

Tasks Pending

Tasks Completed

Employees Online

Recent Activities

Include professional charts

Projects per Department

Department Performance

Employee Performance

Project Status Distribution

Reports Submitted Per Month

Task Completion Rate

Search

Global search should search

Employees

Departments

Projects

Reports

Tasks

Filters

Filter by

Department

Employee

Status

Priority

Date

Project

Report Type

Notifications

Generate notifications when

New project created

Project updated

Task assigned

Task completed

Report submitted

Blocked project detected

New employee registered

Department created

File Uploads

Allow employees to upload

Images

Documents

PDFs

Screenshots

Project files

Display uploaded files inside the corresponding project or report.

UI/UX

Use a premium enterprise interface.

Requirements

Beautiful cards

Glassmorphism where appropriate

Rounded corners

Smooth animations

Professional typography

Responsive layouts

Dark Mode

Light Mode

Professional empty states

Loading skeletons

Modern charts

Progress bars

Timeline components

Excellent mobile experience

Live Data

All dashboards must display live shared data.

When an employee creates or updates a project, report, or task, the Super Admin should immediately see the latest information without needing to recreate or refresh data manually.

The application should be built with a proper backend and persistent database suitable for production use.

Future Scalability

Structure the project so future features can be added easily, including:

Department Managers

Leave Management

Attendance Tracking

Performance Reviews

Internal Chat

Calendar

Project Comments

Team Notifications

Approval Workflows

Build the application with clean architecture, reusable components, and production-ready code so it can scale as the company grows., this must be parfect, build everyhig and dont leave anyone out

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e965be86-524b-498e-a8d7-b27dc8cea9fd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
