# Database Reset Command Design

## Goal

Provide a single development command, `npm run db:reset`, that clears the BirdNET-Pi development database state and repopulates it with realistic sample detections.

## Command

Add `db:reset` to `web-ui/package.json`. The command will invoke the existing `scripts/seed_test_data.py` seeder rather than introduce a second database-reset implementation.

The command targets the seeder's existing default database, `scripts/birds.db`. The seeder's existing `--db` option remains available when it is invoked directly for tests or a custom database path.

## Reset Behavior

On a normal seed run, the seeder will:

1. Create the `detections` table if it does not exist.
2. Delete all existing rows from `detections`.
3. Delete all rows from `reviews` when that table exists.
4. Generate and insert fresh detection seed data.
5. Retain all database tables, indexes, and unrelated table contents.

The existing `--append` mode will preserve both detections and reviews and only add new detection rows.

Generated or real audio files will not be deleted. The configured extracted-audio directory can point at a real BirdNET-Pi recording library, so recursive file cleanup would be unsafe. The existing seeder may continue generating or replacing the placeholder clips needed by the newly seeded rows.

## Error Handling

The npm command will return the Python process's exit status. SQLite or seeding failures therefore make the command fail visibly without reporting a successful reset.

## Testing

Automated Python tests will use temporary SQLite database files and invoke the seeder with small, deterministic inputs and `--no-audio`.

The tests will verify that:

- a normal seed replaces old detections and clears existing reviews;
- `--append` retains existing detections and reviews while adding seed rows;
- a database without a `reviews` table resets successfully.

Verification will also run the relevant test suite and the npm reset command against a temporary database path or equivalent isolated invocation, never against a user's real BirdNET database.
