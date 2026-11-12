# Security

## Report a problem privately

Use GitHub's private vulnerability reporting on this repository: open the **Security** tab, choose **Report a
vulnerability**, and describe what you found. Only the maintainers see it. Please do not open a public issue or pull
request for a security problem, and do not test against other members' real accounts or data.

Include what you did, what happened, and what you expected. A way to repeat it helps most.

## What is in scope

- Signing in: getting a session you should not have, or keeping one after it should end.
- Reading or changing what your angkatan or roles do not allow: another member's data, an announcement, a form's
  answers, Kelola's tools.
- The API's routes and the live connection (socket.io), including rate limits and uploads.
- Anything that leaks a real person's details through the app, its logs or this repository.
- A secret in the repository or in a build.

## Curhat Yuk! is security

Curhat Yuk! is anonymous to HMIF Welfare. Anything that shows who owns a room or wrote a message, or shows a message
to someone who should not see it, is a security problem even when no one can break in. Report it here, not as a bug.

## Out of scope

Reports that need a stolen or already-compromised device, social engineering of members or maintainers, denial of
service by sending huge amounts of traffic, and problems in the tools we depend on that are already public (tell the
tool's own maintainers).
