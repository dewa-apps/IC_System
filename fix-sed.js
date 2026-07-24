import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace(
"                updated_at: serverTimestamp()\n                                          // Log activity for adding subtask",
"                updated_at: serverTimestamp()\n              });\n                                          // Log activity for adding subtask"
);
content = content.replace(
"                  created_at: serverTimestamp()\n              } catch (logError) {",
"                  created_at: serverTimestamp()\n                });\n              } catch (logError) {"
);
content = content.replace(
"              debug: debugInfo\n          } else {",
"              debug: debugInfo\n            });\n          } else {"
);
content = content.replace(
"              debug: debugInfo\n        } catch (dbError: any) {",
"              debug: debugInfo\n            });\n        } catch (dbError: any) {"
);
content = content.replace(
"          created_at: serverTimestamp()\n      } catch (logError) {",
"          created_at: serverTimestamp()\n        });\n      } catch (logError) {"
);

fs.writeFileSync('server.ts', content);
