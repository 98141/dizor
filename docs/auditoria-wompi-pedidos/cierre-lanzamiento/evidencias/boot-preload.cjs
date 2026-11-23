// Proceso de prueba: impide leer .env y sustituye únicamente el logger de archivos.
const Module=require('node:module'),path=require('node:path'),original=Module._load,loggerPath=path.resolve(__dirname,'../../../../backend/src/lib/logger.js');
const logger={stream:{write(){}}};for(const k of['debug','http','warn','info','error'])logger[k]=(message,meta)=>{if(k==='error'||k==='info')console.log('BOOT_TEST '+JSON.stringify({level:k,message,...meta}));};
Module._load=function(name,parent,isMain){if(name==='dotenv')return{config(){}};let resolved;try{resolved=Module._resolveFilename(name,parent);}catch{}if(resolved&&path.resolve(resolved)===loggerPath)return logger;return original.apply(this,arguments);};
