const fs = require('fs');
let code = fs.readFileSync('src/components/DataListJadwalView.tsx', 'utf8');

code = code.replace(/openAddModal,\n    openEditModal: \(defaultDate\?: string\) => void;\n  openEditModal: \(jadwal: DataListJadwal\) => void;/, "openAddModal: (defaultDate?: string) => void;\n  openEditModal: (jadwal: DataListJadwal) => void;");

code = code.replace(/const openAddModal,\n    openEditModal = \(defaultDate\?: string\) => \{/, "const openAddModal = (defaultDate?: string) => {");

code = code.replace(/useImperativeHandle\(ref, \(\) => \(\{\n    openAddModal,\n    openEditModal\n  \}\)\);/, "useImperativeHandle(ref, () => ({\n    openAddModal,\n    openEditModal\n  }));");

code = code.replace(/onClick=\{\(\) => openAddModal,\n    openEditModal\(dateStr\)\}/g, "onClick={() => openAddModal(dateStr)}");

fs.writeFileSync('src/components/DataListJadwalView.tsx', code);
