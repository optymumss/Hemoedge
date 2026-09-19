<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Plan execution preference

When a written plan (via the writing-plans skill) is ready to execute, always use Inline Execution (superpowers:executing-plans) directly in the current session. Do not ask which execution approach to use, and do not offer or default to Subagent-Driven Development (superpowers:subagent-driven-development) for this project.

