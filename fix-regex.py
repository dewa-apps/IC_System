import re

with open('server.ts', 'r') as f:
    content = f.read()

# 1. updated_at: serverTimestamp() \n // Log activity
content = re.sub(
    r'(updated_at:\s*serverTimestamp\(\))\s*(// Log activity)',
    r'\1\n              });\n              \2',
    content
)

# 2. created_at: serverTimestamp() \n } catch (logError) {
content = re.sub(
    r'(created_at:\s*serverTimestamp\(\))\s*(\} catch \(logError\))',
    r'\1\n                });\n              \2',
    content
)

# 3. debug: debugInfo \n } else {
content = re.sub(
    r'(debug:\s*debugInfo)\s*(\} else \{)',
    r'\1\n            });\n          \2',
    content
)

# 4. debug: debugInfo \n } catch (dbError: any) {
content = re.sub(
    r'(debug:\s*debugInfo)\s*(\} catch \(dbError: any\))',
    r'\1\n            });\n        \2',
    content
)

# 5. created_at: serverTimestamp() \n }); \n } catch (logError) {
# Wait, for the second one, it might be:
content = re.sub(
    r'(created_at:\s*serverTimestamp\(\))\s*(\} catch \(logError\))',
    r'\1\n        });\n      \2',
    content
)

# 6. messages.push \n } \n messages.push({ role: 'user'
content = re.sub(
    r"(content:\s*m\.text)\s*(\}\s*messages\.push\(\{)",
    r"\1\n            });\n          });\n        }\n\n        messages.push({",
    content
)

with open('server.ts', 'w') as f:
    f.write(content)
