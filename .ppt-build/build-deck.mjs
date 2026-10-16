import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const project = 'C:/Users/piyus/Desktop/Devops_capstone/inventory-capstone';
const skill = 'C:/Users/piyus/.codex/plugins/cache/openai-primary-runtime/presentations/26.1013.11914/skills/presentations';
const runtimePython = 'C:/Users/piyus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const out = path.join(project, '.ppt-build');
const fontUtils = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')).href);
const FONT = fontUtils.resolvePresentationFont();
const C = { ink:'#142D3B', navy:'#102B3B', teal:'#167C80', mint:'#D9EFEB', amber:'#E9A544', paper:'#F6F5F0', white:'#FFFFFF', muted:'#627581', line:'#D8E0DE', pale:'#EAF0EE', red:'#B45344', dark2:'#234454' };
const pres = Presentation.create({ slideSize:{width:1280,height:720} });

const P = (n) => path.join(project,'docs','screenshots',n);
function shape(slide, geo, x,y,w,h, fill='none', stroke='none', sw=0, name='') {
  return slide.shapes.add({geometry:geo,name,position:{left:x,top:y,width:w,height:h},fill,line:{style:'solid',fill:stroke,width:sw}});
}
function text(slide, value, x,y,w,h, size=20, color=C.ink, bold=false, opts={}) {
  const s=shape(slide,'textbox',x,y,w,h,'none','none',0,opts.name||'');
  s.text=value;
  s.text.style={fontSize:size,typeface:FONT,color,bold,alignment:opts.align||'left',verticalAlignment:opts.valign||'middle',wrap:true,autoFit:'shrinkText',insets:opts.insets??0,lineSpacing:opts.lineSpacing??1.0};
  return s;
}
function image(slide, filename, x,y,w,h, alt, fit='contain') {
  shape(slide,'roundRect',x-4,y-4,w+8,h+8,C.white,C.line,1,'screenshot-frame');
  return slide.images.add({path:P(filename),alt,fit,position:{left:x,top:y,width:w,height:h},geometry:'roundRect',borderRadius:10});
}
function header(slide, section, titleText, subtitle='') {
  slide.background.fill=C.paper;
  text(slide,section.toUpperCase(),64,34,250,20,13,C.teal,true);
  text(slide,titleText,64,61,1140,54,34,C.ink,true);
  if(subtitle) text(slide,subtitle,66,117,1148,32,17,C.muted,false);
  shape(slide,'rect',64,675,1152,1,C.line,'none',0);
  text(slide,'STOCKPILOT  •  DEVOPS CAPSTONE',64,682,420,18,11,C.muted,true);
  text(slide,String(pres.slides.items.length).padStart(2,'0'),1165,681,50,18,11,C.muted,true,{align:'right'});
}
function notes(slide, body, sources=[]) { slide.speakerNotes.text=`${body}${sources.length?'\n\nEvidence/source files: '+sources.join(', '):''}`; }
function label(slide, value, x,y,w,color=C.teal) { shape(slide,'roundRect',x,y,w,26,color,'none',0); text(slide,value,x+10,y+1,w-20,23,12,C.white,true); }

// 1 — cover
{
 const s=pres.slides.add(); s.background.fill=C.navy;
 shape(s,'rect',0,0,12,720,C.teal);
 text(s,'DEVOPS CAPSTONE  /  2026',68,72,420,24,14,'#9ED9D2',true);
 text(s,'StockPilot',68,132,520,76,54,C.white,true);
 text(s,'Inventory management with a traceable\nDevOps delivery path',70,228,520,96,27,'#DBE6E7',false,{lineSpacing:1.08});
 shape(s,'rect',70,354,64,4,C.amber,'none',0);
 text(s,'React  •  FastAPI  •  PostgreSQL  •  AWS EKS',70,385,520,32,18,C.white,true);
 text(s,'A working inventory app, shipped through CI and GitOps,\nwith Kubernetes health and monitoring evidence.',70,443,500,66,18,'#AEC0C4',false,{lineSpacing:1.12});
 image(s,'local-dashboard-smoke.png',632,116,578,418,'Local StockPilot dashboard showing seeded demo inventory');
 text(s,'Local seeded demo view',642,547,560,22,13,'#AEC0C4',false,{align:'right'});
 text(s,'STOCKPILOT  •  DEVOPS CAPSTONE',70,674,500,18,11,'#AEC0C4',true);
 notes(s,'Introduce StockPilot as a small inventory application built to demonstrate the complete software delivery path. The dashboard image is from local seeded demo data; the deployment, CI and monitoring evidence appears later.',['docs/screenshots/local-dashboard-smoke.png']);
}
// 2 — product
{
 const s=pres.slides.add(); header(s,'01  /  THE PRODUCT','Inventory work, made visible','A focused first release: products, stock movements, and reorder attention.');
 image(s,'local-dashboard-smoke.png',64,174,682,414,'Local dashboard with demo products, inventory value and low-stock indicators');
 label(s,'PRODUCT WORKFLOW',790,183,172);
 text(s,'Keep the stock ledger trustworthy',790,225,405,54,26,C.ink,true);
 const lines=[['01','Manage products','SKU, category, INR price and reorder threshold.'],['02','Record stock changes','Receive, issue or adjust; each change creates a movement.'],['03','Act on low stock','Search products and surface items below their threshold.']];
 lines.forEach((it,i)=>{const y=298+i*93;shape(s,'ellipse',790,y,34,34,i===2?C.amber:C.teal,'none',0);text(s,it[0],790,y,34,34,12,C.white,true,{align:'center'});text(s,it[1],841,y-2,350,28,19,C.ink,true);text(s,it[2],841,y+28,355,43,15,C.muted,false,{valign:'top'});});
 text(s,'The figures shown are fictional local demo data, not live AWS inventory.',790,590,404,44,13,C.muted,false);
 notes(s,'The application supports product CRUD and stock-in/out/adjust transactions. Quantity is changed through a transaction endpoint so movement history can be retained. The dashboard screenshot shows fictional seeded local data: five products, 87 units, ₹52,713 inventory value and two low-stock alerts.',['docs/screenshots/local-dashboard-smoke.png','backend/app/routers/products.py','backend/app/routers/movements.py']);
}
// 3 — architecture
{
 const s=pres.slides.add(); header(s,'02  /  ARCHITECTURE','One app, two connected paths','User traffic flows through the cluster; commits flow through CI and GitOps.');
 // user/runtime lane
 label(s,'RUNTIME PATH',64,166,140);
 const boxes=[
  {x:64,w:190,t:'Browser',d:'React + Vite\nStockPilot UI',fill:C.white},
  {x:318,w:214,t:'Traefik Ingress',d:'AWS Network Load Balancer\n/ → UI   •   /api → API',fill:C.mint},
  {x:596,w:220,t:'Application',d:'Frontend: 2 replicas\nFastAPI: 2+ replicas',fill:C.white},
  {x:880,w:252,t:'Data + migration',d:'PostgreSQL StatefulSet\ngp3 PVC • Alembic Job',fill:'#FFF0D7'}
 ];
 boxes.forEach(b=>{shape(s,'roundRect',b.x,211,b.w,104,b.fill,C.line,1);text(s,b.t,b.x+15,224,b.w-30,26,18,C.ink,true,{align:'center'});text(s,b.d,b.x+12,256,b.w-24,46,14,C.muted,false,{align:'center'});});
 [[257,318],[532,596],[816,880]].forEach(([x1,x2])=>shape(s,'rightArrow',x1+7,248,x2-x1-14,26,C.teal,'none',0));
 // release lane
 label(s,'RELEASE PATH',64,355,132,C.teal);
 const rel=[
  {x:64,w:218,t:'GitHub Actions',d:'Tests • Helm • Terraform\nBuild + Trivy scan',fill:C.white},
  {x:322,w:200,t:'GHCR',d:'Images tagged\nwith commit SHA',fill:C.mint},
  {x:562,w:202,t:'Argo CD',d:'Watches Git\nHelm application',fill:C.white},
  {x:804,w:328,t:'AWS EKS · ap-south-1',d:'2 AZs • managed nodes • HPA\nPrometheus + Grafana',fill:C.navy,fg:C.white}
 ];
 rel.forEach(b=>{shape(s,'roundRect',b.x,399,b.w,111,b.fill,C.line,1);text(s,b.t,b.x+14,413,b.w-28,27,18,b.fg||C.ink,true,{align:'center'});text(s,b.d,b.x+13,446,b.w-26,52,14,b.fg? '#DBE6E7':C.muted,false,{align:'center'});});
 [[282,322],[522,562],[764,804]].forEach(([x1,x2])=>shape(s,'rightArrow',x1+4,442,x2-x1-8,25,C.amber,'none',0));
 // observability link
 shape(s,'roundRect',1160,211,56,299,'#E5ECEA',C.line,1);
 text(s,'Observe',1164,225,48,30,12,C.teal,true,{align:'center'});
 text(s,'Prometheus\n↓\nGrafana',1165,284,46,90,13,C.ink,true,{align:'center'});
 text(s,'metrics',1164,414,48,24,11,C.muted,false,{align:'center'});
 text(s,'Traffic uses the Ingress; release automation uses Git and registry images.',64,552,1120,28,16,C.muted,false);
 shape(s,'roundRect',64,596,1152,50,'#FFF0D7','none',0);
 text(s,'Status note: GitHub tests/build/scan passed; the optional Actions → AWS deploy job was skipped. Argo CD sync was verified separately.',82,604,1115,34,14,C.ink,true);
 notes(s,'Explain both planes. Runtime: the browser reaches a Traefik load balancer; Ingress routes root traffic to React and /api to FastAPI. FastAPI uses PostgreSQL with durable gp3 storage. A release migration Job runs Alembic before normal application operation. Delivery: GitHub Actions verifies and publishes SHA-tagged images to GHCR; Argo CD watches the repository Helm definition and reconciles the AWS EKS application. Prometheus and Grafana provide monitoring. The screenshot evidence shows successful CI and separately verified healthy Argo CD; the optional GitHub Actions AWS deployment job was skipped, so do not describe that job as successful.', ['helm/stockpilot','argocd/','terraform/','docs/screenshots/github_actions.png','docs/screenshots/image(1).png']);
}
// 4 — CI/CD
{
 const s=pres.slides.add(); header(s,'03  /  CONTINUOUS DELIVERY','Every image has a commit behind it','The green checks are the gate before a release is published.');
 image(s,'github_actions.png',64,174,690,416,'GitHub Actions run showing passed test and image build scan publish jobs; AWS deployment skipped');
 label(s,'PIPELINE',804,181,94);
 const flow=[['1','Test','PostgreSQL-backed API tests and frontend checks'],['2','Build + scan','Build images; Trivy blocks high/critical findings'],['3','Publish','Push successful main images to GHCR with SHA tags'],['4','Deploy','Argo CD reconciles the matching Helm release']];
 flow.forEach((it,i)=>{let y=228+i*82;shape(s,'ellipse',806,y,34,34,i===3?C.amber:C.teal,'none',0);text(s,it[0],806,y,34,34,14,C.white,true,{align:'center'});text(s,it[1],855,y-2,310,27,19,C.ink,true);text(s,it[2],855,y+27,324,42,14,C.muted,false,{valign:'top'});});
 shape(s,'roundRect',802,573,402,60,'#FFF0D7','none',0);
 text(s,'Evidence detail: “deploy-aws” was skipped in this run. AWS was deployed and synced through Argo CD.',818,580,370,47,13,C.ink,true);
 notes(s,'The supplied Actions screenshot is a successful workflow: test and build-scan-publish completed successfully. The deploy-aws job is visibly skipped. Therefore present GitHub-hosted CI/image publishing as verified and AWS deployment as separately performed and verified with Argo CD. SHA-tagged images make a release traceable to a source commit.',['docs/screenshots/github_actions.png','.github/workflows/']);
}
// 5 — AWS deployment
{
 const s=pres.slides.add(); header(s,'04  /  KUBERNETES','A healthy release on AWS EKS','Real cluster evidence: workloads, migration, storage and ingress.');
 image(s,'image(1).png',64,174,720,432,'Terminal showing AWS Kubernetes pods, services, ingress, HPA, PVC and completed migration Job');
 label(s,'DEPLOYMENT CHECK',824,181,174);
 const checks=[['2 / 2','EKS worker nodes Ready'],['2 + 2','Backend + frontend pods Running'],['Bound','PostgreSQL gp3 persistent volume'],['Complete','Alembic migration Job'],['2 of 2–6','Backend HPA at minimum; ~3% CPU vs 60% target']];
 checks.forEach((it,i)=>{let y=228+i*68;text(s,it[0],824,y,132,27,19,i===4?C.amber:C.teal,true);text(s,it[1],958,y,244,42,14,C.ink,false,{valign:'top'});});
 text(s,'Cluster: stockpilot-eks  •  Region: ap-south-1  •  Ingress: Traefik NLB',824,594,372,38,12,C.muted,false);
 notes(s,'The terminal capture shows the AWS deployment state after sync: two backend replicas and two frontend replicas are Running, PostgreSQL is Running, the migration Job completed, the gp3 PVC is Bound, and the backend HPA has minimum two, maximum six, with two replicas at roughly 3% CPU against the 60% target. This is healthy deployment evidence, not proof that autoscaling exceeded its minimum.',['docs/screenshots/image(1).png','docs/screenshots/kubectlgetnodesterraform.png']);
}
// 6 — app + commit identity
{
 const s=pres.slides.add(); header(s,'05  /  VERIFIED APPLICATION','The running app identifies its release','A live endpoint ties the AWS-served application back to a source commit.');
 image(s,'kubernetes synced.png',64,174,664,402,'StockPilot dashboard served through the AWS ingress, with deployed commit shown');
 image(s,'image(2).png',758,194,458,306,'Terminal request to the AWS /api/version endpoint returning the StockPilot commit');
 label(s,'RELEASE ID',758,526,112,C.teal);
 text(s,'9e5b89aefb8f…',758,564,440,35,22,C.ink,true);
 text(s,'/api/version returned the StockPilot service name and deployed commit SHA.',758,604,437,38,14,C.muted,false);
 notes(s,'Show that this was not only a successful rollout: the Ingress served the StockPilot dashboard and /api/version returned service StockPilot with commit 9e5b89aefb8f79cccce90c6e12f3ae93c31d5adb. The browser dashboard is empty because this deployed database had no demo seed records; the local demo dashboard on slide 2 shows fictional seed data.',['docs/screenshots/kubernetes synced.png','docs/screenshots/image(2).png']);
}
// 7 — observability
{
 const s=pres.slides.add(); header(s,'06  /  OBSERVABILITY','See the service while it is under traffic','Prometheus collects metrics; Grafana makes the runtime behavior readable.');
 image(s,'grafana.png',64,174,802,432,'Grafana StockPilot dashboard with request rate, latency, CPU and error panels');
 image(s,'prometheus.png',890,174,326,432,'Prometheus targets page, with visible Kubernetes scrape targets marked UP');
 text(s,'Grafana · request rate, p95 latency, errors and CPU',66,615,790,26,14,C.ink,true);
 text(s,'Prometheus · target health',892,615,324,26,14,C.ink,true);
 notes(s,'This Grafana capture shows request-rate activity peaking around 30 requests/second, p95 latency around 14 ms at the visible peak, no visible 5xx errors, and a CPU response during generated traffic. The Prometheus capture shows targets marked UP on the visible page; it does not clearly expose the StockPilot service target in the screenshot, so describe it as Prometheus target-health evidence rather than claiming a specific target row. HPA remained at two replicas as shown earlier.',['docs/screenshots/grafana.png','docs/screenshots/prometheus.png']);
}
// 8 — conclusion
{
 const s=pres.slides.add(); s.background.fill=C.navy;
 text(s,'07  /  TAKEAWAY',64,50,310,22,13,'#9ED9D2',true);
 text(s,'A release you can follow\nfrom commit to cluster',64,96,650,106,39,C.white,true,{lineSpacing:1.02});
 text(s,'StockPilot brings together an inventory workflow, automated quality gates, a GitOps-managed AWS deployment, and operational visibility.',66,232,575,70,20,'#D8E3E4',false,{lineSpacing:1.12});
 const steps=[['CODE','Product + stock ledger'],['VERIFY','Tests + image scan'],['PUBLISH','Commit-tagged images'],['RECONCILE','Argo CD → EKS'],['OBSERVE','Prometheus + Grafana']];
 steps.forEach((it,i)=>{let y=354+i*52;shape(s,'ellipse',68,y,25,25,i===4?C.amber:C.teal,'none',0);text(s,it[0],110,y-2,110,24,12,'#9ED9D2',true);text(s,it[1],228,y-3,430,28,17,C.white,true);});
 shape(s,'roundRect',744,111,468,408,C.dark2,'#486474',1);
 text(s,'What the evidence says',778,143,394,38,24,C.white,true);
 const bullet=['CI test and image-scan/publish jobs passed.','Argo CD reports Synced and Healthy.','AWS EKS workloads and gp3 storage are healthy.','Monitoring shows traffic and service response.','The Actions deploy-aws job was skipped; it is not claimed as a passing step.'];
 bullet.forEach((t,i)=>{let y=205+i*56;shape(s,'ellipse',780,y+6,9,9,i===4?C.amber:'#9ED9D2','none',0);text(s,t,801,y,375,47,15,'#E4ECEC',false,{valign:'top'});});
 shape(s,'rect',64,602,1148,1,'#486474','none',0);
 text(s,'After screenshots and recording: destroy the temporary AWS stack, then verify the cluster, load balancer, NAT gateway and storage are gone.',64,620,1148,40,15,'#F0C47D',true);
 text(s,'STOCKPILOT  •  DEVOPS CAPSTONE',64,681,500,18,11,'#AEC0C4',true);
 text(s,'08',1165,680,48,18,11,'#AEC0C4',true,{align:'right'});
 notes(s,'Close with the verified story and state its boundaries accurately. CI checks and image publication passed. The GitOps application was Synced and Healthy in AWS. Kubernetes workloads and monitoring were verified. The separate deploy-aws GitHub Actions job was skipped in the screenshot. Since the AWS environment was intended to exist only for evidence capture, destroy the stack after the presentation/video and check that billable resources are removed.',['docs/screenshots/github_actions.png','docs/screenshots/image(1).png','docs/screenshots/grafana.png']);
}

await fs.mkdir(out,{recursive:true});
const previews=path.join(out,'slides'); await fs.mkdir(previews,{recursive:true});
for(let i=0;i<pres.slides.items.length;i++){
 const blob=await pres.export({slide:pres.slides.items[i],format:'png',scale:1});
 await fs.writeFile(path.join(previews,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await blob.arrayBuffer()));
}
const candidate=path.join(out,'StockPilot-presentation-candidate.pptx');
await (await PresentationFile.exportPptx(pres)).save(candidate);
const finalPath=path.join(project,'StockPilot.pptx');
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
const result=await finalizePresentation({workspaceDir:project,candidatePath:candidate,finalPath,pythonExecutable:runtimePython,integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(out,'StockPilot.validation.json')});
console.log(JSON.stringify({finalPath,font:FONT,slides:pres.slides.items.length,result},null,2));
