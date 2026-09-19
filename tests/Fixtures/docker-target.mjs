import { createServer } from 'node:http'
createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<html><head><title>Docker target</title></head><body><h1>Existing Docker environment</h1><p>Captured over a shared network.</p></body></html>')}).listen(8080,'0.0.0.0')
