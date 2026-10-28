const cp=require('node:child_process');
const suites=['library','stage2','coach','analytics','v4','timing'];
if(process.argv.includes('--browser'))suites.push('simple-browser','simple-catalog-browser','simple-update-browser');
for(const suite of suites){console.log('Checking '+suite);const result=cp.spawnSync(process.execPath,['tests/'+suite+'.cjs'],{stdio:'inherit',timeout:90000});if(result.status!==0){console.error('FAILED '+suite,result.error?.message||'');process.exit(1)}}
console.log('PASS: '+suites.length+' suites.');
