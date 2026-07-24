import re

with open('server.ts', 'r') as f:
    content = f.read()

content = content.replace(
'''            messages.push({
              role: m.role === 'model' ? 'assistant' : 'user',
              content: m.text
                              }                messages.push({''',
'''            messages.push({
              role: m.role === 'model' ? 'assistant' : 'user',
              content: m.text
            });
          });
        }
        messages.push({'''
)

with open('server.ts', 'w') as f:
    f.write(content)
