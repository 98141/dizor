const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),out=path.join(__dirname,'evidencias');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','ignore']});
const lines=s=>s.trim().split(/\r?\n/).filter(Boolean);
const changed=lines(git(['diff','--name-only','--','backend/src','frontend/src']));
const added=lines(git(['ls-files','--others','--exclude-standard','--','backend/src','frontend/src']));
let diff=git(['diff','--binary','HEAD','--','backend/src','frontend/src']);
for(const file of added){try{diff+=git(['diff','--no-index','--','NUL',file]);}catch(e){if(e.status!==1)throw e;diff+=e.stdout;}}
fs.writeFileSync(path.join(out,'codigo.diff'),diff);
const entry=file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')});
fs.writeFileSync(path.join(out,'archivos-codigo.json'),JSON.stringify({head:git(['rev-parse','HEAD']).trim(),branch:git(['branch','--show-current']).trim(),modified:changed.map(entry),added:added.map(entry)},null,2));
fs.writeFileSync(path.join(out,'git-status.txt'),git(['status','--short']));
const artifacts=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else if(e.name!=='archivos-remediacion.json')artifacts.push(entry(path.relative(root,file).replaceAll('\\','/')));}}
walk(__dirname);fs.writeFileSync(path.join(out,'archivos-remediacion.json'),JSON.stringify(artifacts,null,2));
console.log(JSON.stringify({modified:changed.length,added:added.length,artifacts:artifacts.length}));
