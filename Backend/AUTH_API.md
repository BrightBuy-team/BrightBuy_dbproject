# User and Auth API

The API is implemented under `/api/auth` and uses the SQL routines in
`Database/User and Auth`. Apply the `brightbuy` schema, city fixtures, and auth
schema/procedure scripts before starting the backend. Configure the datasource
with the usual Spring `spring.datasource.*` settings.

## Session and CSRF

Authentication uses an HTTP-only server-side session cookie. Sessions expire
after 30 minutes. Because the API uses cookie authentication, first call
`GET /api/auth/csrf` and retain its session cookie and returned `token`. Include
that token as `X-XSRF-TOKEN` and send cookies on each `POST` request. For a
cross-origin frontend, send requests with credentials enabled. Allowed origins
are configured with `catalogue.cors.allowed-origins`.

## Endpoints

| Method and path | Access | Request or response |
|---|---|---|
| `GET /api/auth/csrf` | Public | Returns `{ "token": "..." }` and sets the CSRF cookie. |
| `POST /api/auth/register` | Public + CSRF | Customer fields: `firstName`, `lastName`, `email`, `password`; `cityId`, `phone`, and `addressLine` are optional. |
| `POST /api/auth/login` | Public + CSRF | `email`, `password`, and `accountType` (`CUSTOMER` or `EMPLOYEE`). |
| `POST /api/auth/employees` | Admin + CSRF | Creates an employee with `firstName`, `lastName`, `email`, `password`, optional `contactNo`, and `role` (`WAREHOUSE_STAFF`, `MANAGEMENT`, or `ADMIN`). |
| `GET /api/auth/me` | Authenticated | Returns the current user's `id`, `email`, `accountType`, and `role`. |
| `POST /api/auth/logout` | Authenticated + CSRF | Invalidates the session and CSRF cookie. |

Login failures return a generic message for both unknown emails and incorrect
passwords. The fifth recent failure activates the SQL-backed 15-minute rate
limit. Customer registration and admin-only employee provisioning store BCrypt
hashes and call their corresponding database procedures. The placeholder hashes
in the SQL demo seed intentionally cannot be used to sign in.