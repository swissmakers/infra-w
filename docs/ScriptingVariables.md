# Scripting Variables & Directives

Use `@INFRA-W:*` directives to make scripts interactive, safer, and easier to operate.

## Directive Syntax Reference

| Directive | Purpose | Example |
|---|---|---|
| `@INFRA-W:STEP "text"` | Mark logical execution step | `@INFRA-W:STEP "Validate prerequisites"` |
| `@INFRA-W:INPUT <var> "prompt" "default"` | Prompt for free-text input | `@INFRA-W:INPUT HOST "Target host" "localhost"` |
| `@INFRA-W:SELECT <var> "prompt" "A" "B"` | Prompt for fixed options | `@INFRA-W:SELECT MODE "Deploy mode" "Rolling" "BlueGreen"` |
| `@INFRA-W:CONFIRM "text"` | Require explicit user confirmation | `@INFRA-W:CONFIRM "Continue with restart?"` |
| `@INFRA-W:INFO "text"` | Emit informational message | `@INFRA-W:INFO "Applying configuration"` |
| `@INFRA-W:WARN "text"` | Emit warning message | `@INFRA-W:WARN "Low disk space"` |
| `@INFRA-W:ERROR "text"` | Emit error message (the script keeps running; add `exit 1` to stop) | `@INFRA-W:ERROR "Configuration file not found"` |
| `@INFRA-W:SUCCESS "text"` | Mark successful milestone | `@INFRA-W:SUCCESS "Backup completed"` |
| `@INFRA-W:PROGRESS <0-100\|$var>` | Update progress indicator | `@INFRA-W:PROGRESS 75` |
| `@INFRA-W:SUMMARY "title" "k1" "v1" ...` | Show structured key/value summary | `@INFRA-W:SUMMARY "Result" "Changed" "14"` |
| `@INFRA-W:TABLE "title" "h1,h2" "r1c1,r1c2" ...` | Render tabular output: the first value holds the comma-separated column headers, every further value one row | `@INFRA-W:TABLE "Users" "Name,Role" "alice,admin" "bob,user"` |
| `@INFRA-W:MSGBOX "title" "message"` | Display message dialog | `@INFRA-W:MSGBOX "Completed" "Operation finished"` |

## End-to-End Example

```sh
@INFRA-W:STEP "Collect input"
@INFRA-W:INPUT HOST "Target host" "localhost"
@INFRA-W:SELECT MODE "Deployment mode" "Rolling" "BlueGreen"
@INFRA-W:CONFIRM "Continue with deployment?"

@INFRA-W:STEP "Deploy"
@INFRA-W:INFO "Starting deployment"
@INFRA-W:PROGRESS 20
# deployment commands...
@INFRA-W:PROGRESS 100
@INFRA-W:SUCCESS "Deployment finished"

@INFRA-W:SUMMARY "Deployment Summary" "Host" "$HOST" "Mode" "$MODE" "Status" "Success"
```

## Implementation Notes

- Directives are transformed server-side before execution.
- `sudo` commands are automatically adjusted to support password prompts.
- Escape literal colons in directive payloads when needed.

## Best Practices

- Use `STEP` markers in long-running scripts.
- Use `CONFIRM` before destructive operations.
- Prefer `SELECT` over free-text where possible.
- End critical workflows with `SUMMARY` for auditable output.

## Related

- [Scripts & Snippets](./scripts&snippets.md)
