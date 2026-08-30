"""
scripts/audit_datepickers.py
Alat Audit Otomatis Keselarasan Komponen DatePicker (render vs init)
"""

import os
import re
import sys

# Ensure stdout handles UTF-8 on Windows
if sys.platform == 'win32' and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_audit():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    components_dir = os.path.join(project_root, 'components')

    total_renders = 0
    total_inits = 0
    mismatches = []
    audit_results = []

    for fname in sorted(os.listdir(components_dir)):
        if fname.endswith('.js') and fname != 'DatePicker.js':
            fpath = os.path.join(components_dir, fname)
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()

            renders_raw = re.findall(r"renderDatePickerHTML\s*\(\s*\{([^}]+)\}", content)
            inits_raw = re.findall(r"initDatePicker\s*\(\s*[^,]+,\s*\{([^}]+)\}", content)

            renders = []
            for r in renders_raw:
                m = re.search(r"id:\s*['\"]([^'\"]+)['\"]", r)
                if m:
                    renders.append(m.group(1))

            inits = []
            for i in inits_raw:
                m = re.search(r"id:\s*['\"]([^'\"]+)['\"]", i)
                if m:
                    inits.append(m.group(1))

            if renders or inits:
                for r_id in renders:
                    total_renders += 1
                    has_init = r_id in inits
                    if has_init:
                        total_inits += 1
                        audit_results.append((fname, r_id, "PASS"))
                    else:
                        mismatches.append((fname, r_id, "MISSING_INIT"))
                        audit_results.append((fname, r_id, "FAIL"))

    print("================================================================")
    print("LAPORAN AUDIT OTOMATIS KOMPONEN DATEPICKER (RENDER VS INIT)")
    print("================================================================")
    print(f"Total Target DatePicker : {total_renders}")
    print(f"Total Berhasil Terikat  : {total_inits}")
    print("----------------------------------------------------------------")
    
    for fname, d_id, status in audit_results:
        st_icon = "[OK] AKTIF" if status == "PASS" else "[FAIL] HILANG INIT"
        print(f"• {st_icon:<15} {fname:<25} -> ID: {d_id}")

    print("================================================================")
    if not mismatches and total_renders > 0 and total_renders == total_inits:
        print(f"SEMPURNA: 100% DatePicker ({total_inits}/{total_renders}) ter-binding sempurna!")
        return 0
    else:
        print(f"DITEMUKAN MASALAH: {len(mismatches)} titik belum memiliki initDatePicker!")
        return 1

if __name__ == '__main__':
    sys.exit(run_audit())
