# Details

Date : 2026-09-10 01:53:23

Directory c:\\PADHAI\\webwiz hackathon\\backend

Total : 47 files,  4727 codes, 193 comments, 476 blanks, all 5396 lines

[Summary](results.md) / Details / [Diff Summary](diff.md) / [Diff Details](diff-details.md)

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [backend/.prettierignore](/backend/.prettierignore) | Ignore | 2 | 0 | 0 | 2 |
| [backend/.prettierrc](/backend/.prettierrc) | JSON | 10 | 0 | 1 | 11 |
| [backend/package-lock.json](/backend/package-lock.json) | JSON | 2,301 | 0 | 1 | 2,302 |
| [backend/package.json](/backend/package.json) | JSON | 31 | 0 | 1 | 32 |
| [backend/scripts/migrate-soft-delete.js](/backend/scripts/migrate-soft-delete.js) | JavaScript | 29 | 20 | 10 | 59 |
| [backend/src/app.js](/backend/src/app.js) | JavaScript | 35 | 4 | 8 | 47 |
| [backend/src/controllers/answer.controller.js](/backend/src/controllers/answer.controller.js) | JavaScript | 105 | 5 | 27 | 137 |
| [backend/src/controllers/auth.controller.js](/backend/src/controllers/auth.controller.js) | JavaScript | 322 | 16 | 81 | 419 |
| [backend/src/controllers/course.controller.js](/backend/src/controllers/course.controller.js) | JavaScript | 148 | 11 | 35 | 194 |
| [backend/src/controllers/document.controller.js](/backend/src/controllers/document.controller.js) | JavaScript | 157 | 19 | 31 | 207 |
| [backend/src/controllers/module.controller.js](/backend/src/controllers/module.controller.js) | JavaScript | 120 | 2 | 29 | 151 |
| [backend/src/controllers/qa.controller.js](/backend/src/controllers/qa.controller.js) | JavaScript | 82 | 16 | 20 | 118 |
| [backend/src/controllers/question.controller.js](/backend/src/controllers/question.controller.js) | JavaScript | 128 | 3 | 28 | 159 |
| [backend/src/db/db.js](/backend/src/db/db.js) | JavaScript | 15 | 0 | 3 | 18 |
| [backend/src/middlewares/auth.middleware.js](/backend/src/middlewares/auth.middleware.js) | JavaScript | 34 | 10 | 10 | 54 |
| [backend/src/middlewares/error-handler.middleware.js](/backend/src/middlewares/error-handler.middleware.js) | JavaScript | 44 | 8 | 11 | 63 |
| [backend/src/middlewares/handle-upload-errors.middleware.js](/backend/src/middlewares/handle-upload-errors.middleware.js) | JavaScript | 16 | 6 | 2 | 24 |
| [backend/src/middlewares/upload.middleware.js](/backend/src/middlewares/upload.middleware.js) | JavaScript | 36 | 2 | 7 | 45 |
| [backend/src/middlewares/validator.middleware.js](/backend/src/middlewares/validator.middleware.js) | JavaScript | 14 | 2 | 5 | 21 |
| [backend/src/models/answer.model.js](/backend/src/models/answer.model.js) | JavaScript | 57 | 1 | 3 | 61 |
| [backend/src/models/course.model.js](/backend/src/models/course.model.js) | JavaScript | 70 | 4 | 3 | 77 |
| [backend/src/models/document.model.js](/backend/src/models/document.model.js) | JavaScript | 56 | 5 | 3 | 64 |
| [backend/src/models/module.model.js](/backend/src/models/module.model.js) | JavaScript | 50 | 3 | 3 | 56 |
| [backend/src/models/question.model.js](/backend/src/models/question.model.js) | JavaScript | 51 | 1 | 3 | 55 |
| [backend/src/models/user.model.js](/backend/src/models/user.model.js) | JavaScript | 113 | 7 | 9 | 129 |
| [backend/src/routes/answer.route.js](/backend/src/routes/answer.route.js) | JavaScript | 27 | 5 | 8 | 40 |
| [backend/src/routes/auth.route.js](/backend/src/routes/auth.route.js) | JavaScript | 34 | 2 | 15 | 51 |
| [backend/src/routes/course.route.js](/backend/src/routes/course.route.js) | JavaScript | 35 | 4 | 8 | 47 |
| [backend/src/routes/document.route.js](/backend/src/routes/document.route.js) | JavaScript | 38 | 2 | 7 | 47 |
| [backend/src/routes/module.route.js](/backend/src/routes/module.route.js) | JavaScript | 32 | 2 | 7 | 41 |
| [backend/src/routes/qa.route.js](/backend/src/routes/qa.route.js) | JavaScript | 20 | 1 | 4 | 25 |
| [backend/src/routes/question.route.js](/backend/src/routes/question.route.js) | JavaScript | 25 | 4 | 8 | 37 |
| [backend/src/server.js](/backend/src/server.js) | JavaScript | 15 | 0 | 3 | 18 |
| [backend/src/services/answer-workflow.service.js](/backend/src/services/answer-workflow.service.js) | JavaScript | 27 | 1 | 5 | 33 |
| [backend/src/services/rag.service.js](/backend/src/services/rag.service.js) | JavaScript | 43 | 6 | 12 | 61 |
| [backend/src/utils/api-error.js](/backend/src/utils/api-error.js) | JavaScript | 23 | 0 | 2 | 25 |
| [backend/src/utils/api-response.js](/backend/src/utils/api-response.js) | JavaScript | 9 | 0 | 1 | 10 |
| [backend/src/utils/async-handler.js](/backend/src/utils/async-handler.js) | JavaScript | 8 | 0 | 1 | 9 |
| [backend/src/utils/constants.js](/backend/src/utils/constants.js) | JavaScript | 12 | 1 | 3 | 16 |
| [backend/src/utils/course-access.js](/backend/src/utils/course-access.js) | JavaScript | 32 | 14 | 8 | 54 |
| [backend/src/utils/mail.js](/backend/src/utils/mail.js) | JavaScript | 68 | 0 | 8 | 76 |
| [backend/src/validators/answer.validator.js](/backend/src/validators/answer.validator.js) | JavaScript | 32 | 2 | 6 | 40 |
| [backend/src/validators/auth.validator.js](/backend/src/validators/auth.validator.js) | JavaScript | 82 | 0 | 10 | 92 |
| [backend/src/validators/course.validator.js](/backend/src/validators/course.validator.js) | JavaScript | 50 | 0 | 9 | 59 |
| [backend/src/validators/document.validator.js](/backend/src/validators/document.validator.js) | JavaScript | 23 | 4 | 4 | 31 |
| [backend/src/validators/module.validator.js](/backend/src/validators/module.validator.js) | JavaScript | 27 | 0 | 5 | 32 |
| [backend/src/validators/question.validator.js](/backend/src/validators/question.validator.js) | JavaScript | 39 | 0 | 8 | 47 |

[Summary](results.md) / Details / [Diff Summary](diff.md) / [Diff Details](diff-details.md)