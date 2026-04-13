const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all client.tsx and Client.tsx files in src/app/dashboard
const files = execSync('find src/app/dashboard -name "client.tsx" -o -name "Client.tsx" -o -name "AraclarClient.tsx" -o -name "*DetailClient.tsx" -o -name "OnayMerkeziClient.tsx"').toString().split('\n').filter(Boolean);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('Dialog')) continue;

  // Replace import
  content = content.replace(/import\s+\{[^}]*Dialog[^}]*\}\s+from\s+["'][^"']*components\/ui\/dialog["'];/g, 
    'import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";');

  // Replace tags
  content = content.replace(/<Dialog/g, '<Sheet');
  content = content.replace(/<\/Dialog>/g, '</Sheet>');
  content = content.replace(/<DialogTrigger/g, '<SheetTrigger');
  content = content.replace(/<\/DialogTrigger>/g, '</SheetTrigger>');
  content = content.replace(/<DialogContent/g, '<SheetContent');
  content = content.replace(/<\/DialogContent>/g, '</SheetContent>');
  content = content.replace(/<DialogHeader/g, '<SheetHeader');
  content = content.replace(/<\/DialogHeader>/g, '</SheetHeader>');
  content = content.replace(/<DialogTitle/g, '<SheetTitle');
  content = content.replace(/<\/DialogTitle>/g, '</SheetTitle>');
  content = content.replace(/<DialogDescription/g, '<SheetDescription');
  content = content.replace(/<\/DialogDescription>/g, '</SheetDescription>');
  content = content.replace(/<DialogFooter/g, '<SheetFooter');
  content = content.replace(/<\/DialogFooter>/g, '</SheetFooter>');

  // Also replace sm:max-w-[...] to sm:max-w-[540px] for better drawer width
  content = content.replace(/className="sm:max-w-\[([^\]]+)\]"/g, 'className="sm:max-w-[540px]"');
  content = content.replace(/className="max-w-\[([^\]]+)\]"/g, 'className="sm:max-w-[540px]"'); // sometimes without sm:
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}
