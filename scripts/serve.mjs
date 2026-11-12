import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { SOURCE_FILES } from './site.mjs';
const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',png:'image/png'};
createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(!SOURCE_FILES.includes(path)){res.writeHead(404).end();return;}
  try{res.writeHead(200,{'Content-Type':mime[path.split('.').at(-1)]});res.end(await readFile(path));}
  catch{res.writeHead(500).end();}
}).listen(4173,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4173'));
