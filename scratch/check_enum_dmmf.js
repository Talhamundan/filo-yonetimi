
const { Prisma } = require('@prisma/client');
const dmmf = Prisma.dmmf;
const illerEnum = dmmf.datamodel.enums.find(e => e.name === 'iller');
if (illerEnum) {
    console.log('Enum iller:');
    illerEnum.values.forEach(v => {
        console.log(`  ${v.name} -> ${v.dbName || v.name}`);
    });
} else {
    console.log('Enum iller not found in DMMF');
}
