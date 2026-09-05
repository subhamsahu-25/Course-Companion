# Diff Details

Date : 2026-09-05 21:38:31

Directory c:\\PADHAI\\webwiz hackathon\\frontend

Total : 61 files,  -118 codes, -94 comments, -149 blanks, all -361 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [backend/.prettierignore](/backend/.prettierignore) | Ignore | -2 | 0 | 0 | -2 |
| [backend/.prettierrc](/backend/.prettierrc) | JSON | -10 | 0 | -1 | -11 |
| [backend/package-lock.json](/backend/package-lock.json) | JSON | -2,301 | 0 | -1 | -2,302 |
| [backend/package.json](/backend/package.json) | JSON | -30 | 0 | -1 | -31 |
| [backend/src/app.js](/backend/src/app.js) | JavaScript | -32 | -4 | -8 | -44 |
| [backend/src/controllers/answer.controller.js](/backend/src/controllers/answer.controller.js) | JavaScript | -105 | -5 | -27 | -137 |
| [backend/src/controllers/auth.controller.js](/backend/src/controllers/auth.controller.js) | JavaScript | -308 | -13 | -80 | -401 |
| [backend/src/controllers/course.controller.js](/backend/src/controllers/course.controller.js) | JavaScript | -99 | -1 | -24 | -124 |
| [backend/src/controllers/document.controller.js](/backend/src/controllers/document.controller.js) | JavaScript | -89 | -5 | -21 | -115 |
| [backend/src/controllers/module.controller.js](/backend/src/controllers/module.controller.js) | JavaScript | -99 | -2 | -26 | -127 |
| [backend/src/controllers/question.controller.js](/backend/src/controllers/question.controller.js) | JavaScript | -123 | -4 | -27 | -154 |
| [backend/src/db/db.js](/backend/src/db/db.js) | JavaScript | -15 | 0 | -3 | -18 |
| [backend/src/middlewares/auth.middleware.js](/backend/src/middlewares/auth.middleware.js) | JavaScript | -34 | -10 | -10 | -54 |
| [backend/src/middlewares/error-handler.middleware.js](/backend/src/middlewares/error-handler.middleware.js) | JavaScript | -44 | -8 | -11 | -63 |
| [backend/src/middlewares/handle-upload-errors.middleware.js](/backend/src/middlewares/handle-upload-errors.middleware.js) | JavaScript | -16 | -6 | -2 | -24 |
| [backend/src/middlewares/upload.middleware.js](/backend/src/middlewares/upload.middleware.js) | JavaScript | -28 | -1 | -6 | -35 |
| [backend/src/middlewares/validator.middleware.js](/backend/src/middlewares/validator.middleware.js) | JavaScript | -14 | -2 | -5 | -21 |
| [backend/src/models/answer.model.js](/backend/src/models/answer.model.js) | JavaScript | -25 | 0 | -2 | -27 |
| [backend/src/models/course.model.js](/backend/src/models/course.model.js) | JavaScript | -29 | 0 | -2 | -31 |
| [backend/src/models/document.model.js](/backend/src/models/document.model.js) | JavaScript | -33 | 0 | -2 | -35 |
| [backend/src/models/module.model.js](/backend/src/models/module.model.js) | JavaScript | -30 | 0 | -2 | -32 |
| [backend/src/models/question.model.js](/backend/src/models/question.model.js) | JavaScript | -34 | 0 | -2 | -36 |
| [backend/src/models/user.model.js](/backend/src/models/user.model.js) | JavaScript | -114 | -7 | -9 | -130 |
| [backend/src/routes/answer.route.js](/backend/src/routes/answer.route.js) | JavaScript | -27 | -5 | -8 | -40 |
| [backend/src/routes/auth.route.js](/backend/src/routes/auth.route.js) | JavaScript | -34 | -2 | -15 | -51 |
| [backend/src/routes/course.route.js](/backend/src/routes/course.route.js) | JavaScript | -32 | -3 | -7 | -42 |
| [backend/src/routes/document.route.js](/backend/src/routes/document.route.js) | JavaScript | -34 | -3 | -7 | -44 |
| [backend/src/routes/module.route.js](/backend/src/routes/module.route.js) | JavaScript | -32 | -3 | -7 | -42 |
| [backend/src/routes/question.route.js](/backend/src/routes/question.route.js) | JavaScript | -25 | -4 | -8 | -37 |
| [backend/src/server.js](/backend/src/server.js) | JavaScript | -15 | 0 | -3 | -18 |
| [backend/src/services/answer-workflow.service.js](/backend/src/services/answer-workflow.service.js) | JavaScript | -27 | -1 | -5 | -33 |
| [backend/src/utils/api-error.js](/backend/src/utils/api-error.js) | JavaScript | -23 | 0 | -2 | -25 |
| [backend/src/utils/api-response.js](/backend/src/utils/api-response.js) | JavaScript | -9 | 0 | -1 | -10 |
| [backend/src/utils/async-handler.js](/backend/src/utils/async-handler.js) | JavaScript | -8 | 0 | -1 | -9 |
| [backend/src/utils/constants.js](/backend/src/utils/constants.js) | JavaScript | -12 | -1 | -3 | -16 |
| [backend/src/utils/mail.js](/backend/src/utils/mail.js) | JavaScript | -68 | 0 | -8 | -76 |
| [backend/src/validators/answer.validator.js](/backend/src/validators/answer.validator.js) | JavaScript | -32 | -2 | -6 | -40 |
| [backend/src/validators/auth.validator.js](/backend/src/validators/auth.validator.js) | JavaScript | -82 | 0 | -10 | -92 |
| [backend/src/validators/course.validator.js](/backend/src/validators/course.validator.js) | JavaScript | -28 | 0 | -5 | -33 |
| [backend/src/validators/document.validator.js](/backend/src/validators/document.validator.js) | JavaScript | -23 | -4 | -4 | -31 |
| [backend/src/validators/module.validator.js](/backend/src/validators/module.validator.js) | JavaScript | -27 | 0 | -5 | -32 |
| [backend/src/validators/question.validator.js](/backend/src/validators/question.validator.js) | JavaScript | -39 | 0 | -8 | -47 |
| [frontend/README.md](/frontend/README.md) | Markdown | 9 | 0 | 8 | 17 |
| [frontend/eslint.config.js](/frontend/eslint.config.js) | JavaScript | 20 | 0 | 2 | 22 |
| [frontend/index.html](/frontend/index.html) | HTML | 12 | 0 | 1 | 13 |
| [frontend/package-lock.json](/frontend/package-lock.json) | JSON | 3,043 | 0 | 1 | 3,044 |
| [frontend/package.json](/frontend/package.json) | JSON | 28 | 0 | 1 | 29 |
| [frontend/src/App.jsx](/frontend/src/App.jsx) | JavaScript JSX | 82 | 0 | 20 | 102 |
| [frontend/src/api/client.js](/frontend/src/api/client.js) | JavaScript | 22 | 2 | 8 | 32 |
| [frontend/src/components/Sidebar.jsx](/frontend/src/components/Sidebar.jsx) | JavaScript JSX | 66 | 0 | 14 | 80 |
| [frontend/src/index.css](/frontend/src/index.css) | PostCSS | 16 | 0 | 3 | 19 |
| [frontend/src/layouts/RoleLayout.jsx](/frontend/src/layouts/RoleLayout.jsx) | JavaScript JSX | 26 | 0 | 4 | 30 |
| [frontend/src/main.jsx](/frontend/src/main.jsx) | JavaScript JSX | 9 | 0 | 1 | 10 |
| [frontend/src/pages/Login.jsx](/frontend/src/pages/Login.jsx) | JavaScript JSX | 65 | 0 | 20 | 85 |
| [frontend/src/pages/admin/Modules.jsx](/frontend/src/pages/admin/Modules.jsx) | JavaScript JSX | 66 | 0 | 19 | 85 |
| [frontend/src/pages/admin/Upload.jsx](/frontend/src/pages/admin/Upload.jsx) | JavaScript JSX | 170 | 0 | 40 | 210 |
| [frontend/src/pages/student/Ask.jsx](/frontend/src/pages/student/Ask.jsx) | JavaScript JSX | 107 | 0 | 29 | 136 |
| [frontend/src/pages/student/Dashboard.jsx](/frontend/src/pages/student/Dashboard.jsx) | JavaScript JSX | 98 | 0 | 20 | 118 |
| [frontend/src/pages/student/Modules.jsx](/frontend/src/pages/student/Modules.jsx) | JavaScript JSX | 69 | 0 | 16 | 85 |
| [frontend/src/pages/ta/ReviewQueue.jsx](/frontend/src/pages/ta/ReviewQueue.jsx) | JavaScript JSX | 156 | 0 | 28 | 184 |
| [frontend/vite.config.js](/frontend/vite.config.js) | JavaScript | 9 | 0 | 1 | 10 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details