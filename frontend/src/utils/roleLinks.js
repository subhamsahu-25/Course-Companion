const studentLinks = [
  ['student-dashboard', 'Dashboard'],
  ['student-join', 'Join a course'],
  ['student-courses', 'Courses'],
  ['student-ask', 'Ask a question'],
  ['student-history', 'History'],
  ['account', 'Account'],
];

const taLinks = [
  ['ta-review', 'Review queue'],
  ['ta-join', 'Join a course'],
  ['account', 'Account'],
];

const adminLinks = [
  ['admin-courses', 'Courses'],
  ['admin-upload', 'Upload material'],
  ['account', 'Account'],
];

export function linksForRole(role) {
  if (role === 'ta') return taLinks;
  if (role === 'admin' || role === 'instructor') return adminLinks;
  return studentLinks;
}

export function nameForRole(role) {
  if (role === 'ta') return 'Teaching Assistant';
  if (role === 'admin') return 'Admin';
  if (role === 'instructor') return 'Instructor';
  return 'Student';
}
