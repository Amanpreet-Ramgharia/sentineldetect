import re

with open("app/(dashboard)/layout.tsx") as f:
    src = f.read()

# Add SigmaHQ Hub after sigma import in NAV array
old = "  { href:'/sigma',        label:'Sigma Import'    },"
new = "  { href:'/sigma',        label:'Sigma Import'    },\n  { href:'/sigma-hub',    label:'SigmaHQ Hub'     },"
if old in src:
    src = src.replace(old, new)
    print("Nav updated")
else:
    print("WARN: nav target not found")

# Add PAGE_TITLES entry
old2 = "  '/sigma':        'Sigma Import',"
new2 = "  '/sigma':        'Sigma Import',\n  '/sigma-hub':    'SigmaHQ Community Rules',"
if old2 in src:
    src = src.replace(old2, new2)
    print("PAGE_TITLES updated")

with open("app/(dashboard)/layout.tsx", "w") as f:
    f.write(src)
print("Done")
