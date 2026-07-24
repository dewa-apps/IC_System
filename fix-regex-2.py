import re

with open('server.ts', 'r') as f:
    content = f.read()

content = re.sub(
    r'(debug:\s*debugInfo)\s*\}',
    r'\1\n            });\n          }',
    content, count=1
)

content = re.sub(
    r'(debug:\s*debugInfo)\s*\}',
    r'\1\n            });\n        }',
    content, count=1
)

with open('server.ts', 'w') as f:
    f.write(content)
