export const AvailableUserRoles = {
   ADMIN: "admin",
   TA: "ta",
   STUDENT: "student"
}

export const AvailableUserRole = Object.values(AvailableUserRoles); // ["admin", "project_admin", "member"] -- just the values of the object and not the keys. 
// so we have both the object literals as well as the array. 

export const approvalStateEnum = {
   DRAFT: "draft",
   REVIEWED: "reviewed",
   PUBLISHER: "published",
}

export const AvailableApprovalState = Object.values(approvalStateEnum);