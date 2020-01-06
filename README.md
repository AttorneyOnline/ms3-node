# ms3

An HTTP-based master server for SOMETHING.

No WebSockets. No raw TCP. None of that crap. You just send a heartbeat to post
your server on the list and send heartbeats to update info or keep the listing
alive. The server entry dies 5 minutes after the last heartbeat.

## Starting

Set environment variables:

- `PORT` - HTTP port to listen on; defaults to 8000
- `DB_URI` - URI of the database to use; defaults to an in-memory SQLite DB
  - You can use PostgreSQL, MySQL, SQL Server, SQLite, whatever floats your boat

Start it:

```sh
npm start
```

You now have a "master server."

## API

### `GET /servers`

Returns an array of servers containing at least:

- `ip`: IPv4/IPv6 address
- `port`: TCP port
- `wsPort`: WebSockets port (for that webAO nonsense)
- `name`
- `description`

The list should be presented in the order provided.

### `POST /servers`

Sends a heartbeat for a new or existing server.

- `port`
- `ws_port` (optional)
- `players` (optional) - a hint for player count
- `name`
- `description` (optional)

Returns 400 if validation error occurred.
