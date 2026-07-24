import re

with open('server.ts', 'r') as f:
    content = f.read()

content = content.replace(
    'updated_at: serverTimestamp()                                          // Log activity for adding subtask',
    'updated_at: serverTimestamp()\n            });\n            // Log activity for adding subtask'
)

content = content.replace(
    'created_at: serverTimestamp()                              } catch (logError) {',
    'created_at: serverTimestamp()\n                });\n              } catch (logError) {'
)

content = content.replace(
    'debug: debugInfo                      }',
    'debug: debugInfo\n            });\n          }'
)

content = content.replace(
    'debug: debugInfo                    }',
    'debug: debugInfo\n          });\n        }'
)

content = content.replace(
    'created_at: serverTimestamp()        });',
    'created_at: serverTimestamp()\n        });'
)

with open('server.ts', 'w') as f:
    f.write(content)
