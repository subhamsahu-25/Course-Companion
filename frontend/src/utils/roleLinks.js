const studentLinks = [
   ['student-dashboard', 'Dashboard'],
   ['student-courses', 'Courses'],
   ['student-ask', 'Ask a question'],
]

const taLinks = [['ta-review', 'Review queue']]

const adminLinks = [
   ['admin-courses', 'Courses'],
   ['admin-upload', 'Upload material'],
]

export function linksForRole(role) {
   if (role === 'ta') return taLinks
   if (role === 'admin' || role === 'instructor') return adminLinks
   return studentLinks
}

export function nameForRole(role) {
   if (role === 'ta') return 'Teaching Assistant'
   if (role === 'admin') return 'Admin'
   if (role === 'instructor') return 'Instructor'
   return 'Student'
}