import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1?bundle&target=deno"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const W = 792, H = 612, M = 36, CW = W - M * 2
const TCOLS = [
  { key: "trip_number",     label: "#",        w: 32  },
  { key: "date",            label: "Date",      w: 58  },
  { key: "driver",          label: "Driver",    w: 68  },
  { key: "rider",           label: "Rider",     w: 68  },
  { key: "pickup_address",  label: "Pickup",    w: 108 },
  { key: "dropoff_address", label: "Drop-off",  w: 108 },
  { key: "miles_traveled",  label: "Miles",     w: 34  },
  { key: "rider_count",     label: "Rdrs",      w: 30  },
  { key: "rate_applied",    label: "Rate",      w: 40  },
  { key: "differential",    label: "Diff",      w: 36  },
  { key: "trip_total",      label: "Total",     w: 50  },
  { key: "signature",       label: "Signature", w: 88  },
]
const SIG_H=56,TEXT_H=18,HDR_H=20,FS=7.5,HDR_FS=8
const DGRAY=rgb(0.2,0.2,0.2),LGRAY=rgb(0.85,0.87,0.90),ALTROW=rgb(0.97,0.97,0.97)
const RED=rgb(0.8,0.1,0.1),BLUE=rgb(0.1,0.35,0.7),WHITE=rgb(1,1,1)
const TOTBG=rgb(0.22,0.37,0.62),MGRAY=rgb(0.8,0.8,0.8),SUBGRAY=rgb(0.5,0.5,0.5),STATBG=rgb(0.95,0.97,1.0)

function trunc(font:any,s:string,maxW:number,size:number):string{
  if(!s)return""
  if(font.widthOfTextAtSize(s,size)<=maxW)return s
  let t=s
  while(t.length>0&&font.widthOfTextAtSize(t+"...",size)>maxW)t=t.slice(0,-1)
  return t.length?t+"...":""
}
function hline(page:any,x:number,y:number,w:number,thick=0.5,col=DGRAY){
  page.drawLine({start:{x,y},end:{x:x+w,y},thickness:thick,color:col})
}
function fmtD(ts:string|null):string{
  if(!ts)return"\u2014"
  return new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"America/New_York"})
}
function fmtShort(d:string):string{
  return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})
}
function fmtC(n:number|null):string{return n==null?"\u2014":"$"+Number(n).toFixed(2)}
function fmtM(n:number|null):string{return n==null?"\u2014":Number(n).toFixed(1)}

function drawRiderGroupHeader(doc:any,page:any,y:number,riderName:string,font:any,bold:any,addPageFn:()=>any):{page:any;y:number}{
  const RH=16
  if(y-RH<M+20){page=addPageFn();y=H-M;y=drawTripHeader(page,y,font,bold)}
  page.drawRectangle({x:M,y:y-RH,width:CW,height:RH,color:rgb(0.88,0.91,0.96)})
  page.drawText(riderName,{x:M+4,y:y-RH+4,size:8,font:bold,color:BLUE})
  return{page,y:y-RH}
}

function drawTripHeader(page:any,y:number,font:any,bold:any):number{
  page.drawRectangle({x:M,y:y-HDR_H,width:CW,height:HDR_H,color:LGRAY})
  let x=M
  for(const c of TCOLS){
    page.drawText(trunc(bold,c.label,c.w-3,HDR_FS),{x:x+2,y:y-HDR_H+5,size:HDR_FS,font:bold,color:DGRAY})
    x+=c.w
  }
  hline(page,M,y,CW,0.75);hline(page,M,y-HDR_H,CW,0.75)
  return y-HDR_H
}

async function drawTripRow(doc:any,page:any,y:number,trip:any,idx:number,font:any,bold:any,sigCache:Record<string,Uint8Array|null>):Promise<{page:any;y:number}>{
  const hasSig=!!(trip.signature_url&&sigCache[trip.signature_url])
  const rowH=hasSig?SIG_H:TEXT_H
  if(y-rowH<M+20){page=doc.addPage([W,H]);y=H-M;y=drawTripHeader(page,y,font,bold)}
  if(idx%2===1)page.drawRectangle({x:M,y:y-rowH,width:CW,height:rowH,color:ALTROW})
  const textY=y-rowH+(rowH-FS)/2
  let x=M
  const diffVal=trip.rate_differential&&Number(trip.rate_differential)>0?"+"+fmtC(trip.rate_differential):"\u2014"
  const vals=[String(trip.trip_number??"-"),fmtD(trip.created_at),trip.drivers?.name||"-",trip.riders?.name||"-",trip.pickup_address||trip.start_address||"-",trip.dropoff_address||"-",fmtM(trip.miles_traveled),String(trip.rider_count??1),fmtC(trip.rate_applied),diffVal,fmtC(trip.trip_total),""]
  for(let i=0;i<TCOLS.length;i++){
    const c=TCOLS[i]
    if(c.key==="signature"){
      if(hasSig){try{const img=await doc.embedPng(sigCache[trip.signature_url]!);const sw=c.w-4,sh=rowH-6;page.drawRectangle({x:x+2,y:y-rowH+3,width:sw,height:sh,color:WHITE});page.drawImage(img,{x:x+2,y:y-rowH+3,width:sw,height:sh})}catch{page.drawText("[err]",{x:x+2,y:textY,size:FS,font,color:RED})}}
      else if(!trip.signature_url)page.drawText("! MISSING",{x:x+2,y:textY,size:FS,font:bold,color:RED})
      else page.drawText("-",{x:x+2,y:textY,size:FS,font,color:DGRAY})
    }else{
      page.drawText(trunc(font,vals[i],c.w-4,FS),{x:x+2,y:textY,size:FS,font,color:DGRAY})
    }
    x+=c.w
  }
  hline(page,M,y-rowH,CW,0.3,MGRAY)
  return{page,y:y-rowH}
}

async function buildReport(trips:any[],settings:Record<string,string>,sigCache:Record<string,Uint8Array|null>,dateStart:string,dateEnd:string,title:string):Promise<PDFDocument>{
  const doc=await PDFDocument.create()
  const font=await doc.embedFont(StandardFonts.Helvetica)
  const bold=await doc.embedFont(StandardFonts.HelveticaBold)
  let page=doc.addPage([W,H]);let y=H-M
  const totalRides=trips.length
  const totalRiders=trips.reduce((s:number,t:any)=>s+(t.rider_count||1),0)
  const totalAmt=trips.reduce((s:number,t:any)=>s+(t.trip_total||0),0)
  page.drawText(title,{x:M,y,size:20,font:bold,color:BLUE});y-=22
  page.drawText(`Period: ${fmtShort(dateStart)} - ${fmtShort(dateEnd)}`,{x:M,y,size:10,font,color:DGRAY});y-=14
  page.drawText(`Generated: ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}`,{x:M,y,size:9,font,color:SUBGRAY});y-=8
  hline(page,M,y,CW,1,BLUE);y-=16
  const statW=160,statH=50
  const stats=[{label:"Total Trips",val:String(totalRides)},{label:"Total Riders",val:String(totalRiders)},{label:"Total Amount",val:fmtC(totalAmt)}]
  for(let i=0;i<stats.length;i++){const bx=M+i*(statW+10);page.drawRectangle({x:bx,y:y-statH,width:statW,height:statH,color:STATBG});page.drawText(stats[i].label,{x:bx+8,y:y-18,size:9,font,color:SUBGRAY});page.drawText(stats[i].val,{x:bx+8,y:y-40,size:18,font:bold,color:BLUE})}
  y-=statH+20
  page.drawText("DRIVER SUMMARY",{x:M,y,size:9,font:bold,color:SUBGRAY});y-=4
  const DCOLS=[{label:"Driver",w:200},{label:"Rides",w:60},{label:"Rider Count",w:80},{label:"Payout",w:80}]
  const DTW=420
  const dm:Record<string,{rides:number;riders:number;amt:number}>={}
  for(const t of trips){const n=t.drivers?.name||"Unknown";if(!dm[n])dm[n]={rides:0,riders:0,amt:0};dm[n].rides++;dm[n].riders+=t.rider_count||1;dm[n].amt+=t.trip_total||0}
  const drows=Object.entries(dm).sort((a,b)=>b[1].rides-a[1].rides)
  page.drawRectangle({x:M,y:y-HDR_H,width:DTW,height:HDR_H,color:LGRAY})
  let dx=M;for(const dc of DCOLS){page.drawText(dc.label,{x:dx+2,y:y-HDR_H+5,size:HDR_FS,font:bold,color:DGRAY});dx+=dc.w}
  hline(page,M,y,DTW,0.75);hline(page,M,y-HDR_H,DTW,0.75);y-=HDR_H
  for(let i=0;i<drows.length;i++){const[name,d]=drows[i];if(i%2===1)page.drawRectangle({x:M,y:y-TEXT_H,width:DTW,height:TEXT_H,color:ALTROW});dx=M;for(let j=0;j<DCOLS.length;j++){const v=j===0?trunc(font,name,196,FS):j===1?String(d.rides):j===2?String(d.riders):fmtC(d.amt);page.drawText(v,{x:dx+2,y:y-TEXT_H+5,size:FS,font,color:DGRAY});dx+=DCOLS[j].w};hline(page,M,y-TEXT_H,DTW,0.3,MGRAY);y-=TEXT_H}
  page.drawRectangle({x:M,y:y-TEXT_H,width:DTW,height:TEXT_H,color:TOTBG})
  dx=M;for(let j=0;j<DCOLS.length;j++){const v=j===0?"TOTAL":j===1?String(totalRides):j===2?String(totalRiders):fmtC(totalAmt);page.drawText(v,{x:dx+2,y:y-TEXT_H+5,size:FS,font:bold,color:WHITE});dx+=DCOLS[j].w}
  hline(page,M,y-TEXT_H,DTW,0.75);y-=TEXT_H+22
  page.drawText("TRIP DETAIL",{x:M,y,size:9,font:bold,color:SUBGRAY});y-=4
  y=drawTripHeader(page,y,font,bold)
  for(let i=0;i<trips.length;i++){const r=await drawTripRow(doc,page,y,trips[i],i,font,bold,sigCache);page=r.page;y=r.y}
  if(y-TEXT_H<M){page=doc.addPage([W,H]);y=H-M}
  page.drawRectangle({x:M,y:y-TEXT_H,width:CW,height:TEXT_H,color:TOTBG})
  page.drawText(`TOTAL  ${totalRides} trips  ${totalRiders} riders  ${fmtC(totalAmt)}`,{x:M+4,y:y-TEXT_H+5,size:FS,font:bold,color:WHITE})
  hline(page,M,y-TEXT_H,CW,0.75)
  return doc
}

async function buildInvoice(trips:any[],settings:Record<string,string>,sigCache:Record<string,Uint8Array|null>,weekStart:string,weekEnd:string,invoiceNumber:number):Promise<PDFDocument>{
  const doc=await PDFDocument.create()
  const font=await doc.embedFont(StandardFonts.Helvetica)
  const bold=await doc.embedFont(StandardFonts.HelveticaBold)
  let page=doc.addPage([W,H]);let y=H-M
  const totalAmt=trips.reduce((s:number,t:any)=>s+(t.trip_total||0),0)
  const totalRides=trips.length
  const totalRiders=trips.reduce((s:number,t:any)=>s+(t.rider_count||1),0)
  const LW=300,RX=M+LW+20,RW=CW-LW-20,topY=y
  page.drawText(settings.company_name||"",{x:M,y,size:16,font:bold,color:BLUE});y-=18
  for(const line of[settings.company_address||"",settings.company_city_state_zip||"",`Phone: ${settings.company_phone||""}`,`EIN: ${settings.company_ein||""}`]){page.drawText(line,{x:M,y,size:9,font,color:DGRAY});y-=13}
  let ry=topY
  page.drawText("INVOICE",{x:RX,y:ry,size:22,font:bold,color:BLUE});ry-=20
  const now=new Date(),due=new Date(now);due.setDate(due.getDate()+7)
  const fmtFull=(d:Date)=>d.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})
  const meta:Array<[string,string]>=[["Invoice #",String(invoiceNumber)],["Project",settings.project_name||""],["Date",fmtFull(now)],["Due Date",fmtFull(due)],["Payable To",settings.invoice_payable_to||""],["For",`${settings.invoice_for_org||""} - ${settings.invoice_for_dept||""}`],["Address",`${settings.invoice_for_address||""}, ${settings.invoice_for_city_state_zip||""}`],["Period",`${fmtShort(weekStart)} - ${fmtShort(weekEnd)}`]]
  for(const[lbl,val]of meta){page.drawText(`${lbl}:`,{x:RX,y:ry,size:8,font:bold,color:SUBGRAY});page.drawText(trunc(font,val,RW-65,8),{x:RX+62,y:ry,size:8,font,color:DGRAY});ry-=13}
  y=Math.min(y,ry)-14;hline(page,M,y,CW,1,BLUE);y-=12
  page.drawText(`Trips: ${totalRides}     Riders: ${totalRiders}     Amount Due: ${fmtC(totalAmt)}`,{x:M,y,size:11,font:bold,color:DGRAY});y-=22
  page.drawText("TRIP DETAIL",{x:M,y,size:9,font:bold,color:SUBGRAY});y-=4
  const riderMap=new Map<string,any[]>()
  for(const t of trips){const n=t.riders?.name||"Unknown";if(!riderMap.has(n))riderMap.set(n,[]);riderMap.get(n)!.push(t)}
  const sortedGroups=[...riderMap.entries()].sort((a,b)=>a[0].localeCompare(b[0]))
  for(const[,rt]of sortedGroups)rt.sort((a:any,b:any)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime())
  const addPage=()=>{page=doc.addPage([W,H]);return page}
  y=drawTripHeader(page,y,font,bold)
  let rowIdx=0
  for(const[riderName,rTrips]of sortedGroups){
    const gh=drawRiderGroupHeader(doc,page,y,riderName,font,bold,addPage);page=gh.page;y=gh.y
    for(const trip of rTrips){const r=await drawTripRow(doc,page,y,trip,rowIdx,font,bold,sigCache);page=r.page;y=r.y;rowIdx++}
  }
  const TH=28
  if(y-TH<M){page=doc.addPage([W,H]);y=H-M}
  page.drawRectangle({x:M,y:y-TH,width:CW,height:TH,color:TOTBG})
  page.drawText("TOTAL DUE",{x:M+8,y:y-TH+(TH-11)/2,size:11,font:bold,color:WHITE})
  const totalStr=fmtC(totalAmt),totalW=bold.widthOfTextAtSize(totalStr,14)
  page.drawText(totalStr,{x:M+CW-totalW-8,y:y-TH+(TH-14)/2,size:14,font:bold,color:WHITE})
  return doc
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors})
  try{
    const body=await req.json()
    const{week_start,week_end,date_start,date_end,report_only,report_title,range_start,range_end}=body
    const rangeStart=date_start||week_start
    const rangeEnd=date_end||week_end
    if(!rangeStart||!rangeEnd)return new Response(JSON.stringify({error:"date_start and date_end required"}),{status:400,headers:{...cors,"Content-Type":"application/json"}})
    const queryStart=range_start||`${rangeStart}T00:00:00.000Z`
    const queryEnd=range_end||`${rangeEnd}T23:59:59.999Z`
    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const{data:sRows}=await supabase.from("settings").select("key, value")
    const settings:Record<string,string>={}
    ;(sRows||[]).forEach((r:any)=>(settings[r.key]=r.value))
    const{data:trips,error:tripsErr}=await supabase.from("trips").select("*, drivers(name), riders(name), rate_differential").eq("status","completed").gte("created_at",queryStart).lte("created_at",queryEnd).order("trip_number")
    if(tripsErr)throw tripsErr
    if(!trips?.length)return new Response(JSON.stringify({error:"No completed trips found for this period"}),{status:400,headers:{...cors,"Content-Type":"application/json"}})
    const sigCache:Record<string,Uint8Array|null>={}
    const uniqueSigUrls=[...new Set<string>(trips.map((t:any)=>t.signature_url).filter((u:any):u is string=>!!u))]
    await Promise.all(uniqueSigUrls.map(async(url)=>{
      try{const r=await fetch(url);sigCache[url]=r.ok?new Uint8Array(await r.arrayBuffer()):null}
      catch{sigCache[url]=null}
    }))
    const ts=Date.now()
    const totalAmt=trips.reduce((s:number,t:any)=>s+(t.trip_total||0),0)
    const totalRiders=trips.reduce((s:number,t:any)=>s+(t.rider_count||1),0)

    if(report_only){
      const title=report_title||"Driver Report"
      const reportDoc=await buildReport(trips,settings,sigCache,rangeStart,rangeEnd,title)
      const rBytes=await reportDoc.save()
      const rPath=`reports/report-${rangeStart}-${rangeEnd}-${ts}.pdf`
      const{error:upErr}=await supabase.storage.from("pdfs").upload(rPath,rBytes,{contentType:"application/pdf"})
      if(upErr)throw upErr
      const{data:rUrl}=supabase.storage.from("pdfs").getPublicUrl(rPath)
      return new Response(JSON.stringify({report_url:rUrl.publicUrl,total_rides:trips.length,total_amount:totalAmt}),{headers:{...cors,"Content-Type":"application/json"}})
    }

    const{data:invoice,error:invErr}=await supabase.from("invoices").insert({week_start:rangeStart,week_end:rangeEnd,total_rides:trips.length,total_riders:totalRiders,total_amount:totalAmt}).select().single()
    if(invErr)throw invErr
    const invoiceDoc=await buildInvoice(trips,settings,sigCache,rangeStart,rangeEnd,invoice.invoice_number)
    const iBytes=await invoiceDoc.save()
    const iPath=`weekly/invoice-${rangeStart}-${ts}.pdf`
    const iUp=await supabase.storage.from("pdfs").upload(iPath,iBytes,{contentType:"application/pdf"})
    if(iUp.error)throw iUp.error
    const{data:iUrl}=supabase.storage.from("pdfs").getPublicUrl(iPath)
    const{error:updErr}=await supabase.from("invoices").update({pdf_url:iUrl.publicUrl}).eq("id",invoice.id)
    if(updErr)throw updErr

    const reportDoc=await buildReport(trips,settings,sigCache,rangeStart,rangeEnd,"Weekly Driver Report")
    const rBytes=await reportDoc.save()
    const rPath=`reports/report-${rangeStart}-${ts}.pdf`
    const rUp=await supabase.storage.from("pdfs").upload(rPath,rBytes,{contentType:"application/pdf"})
    if(rUp.error)throw rUp.error
    const{data:rUrl}=supabase.storage.from("pdfs").getPublicUrl(rPath)
    return new Response(JSON.stringify({invoice_id:invoice.id,invoice_number:invoice.invoice_number,invoice_url:iUrl.publicUrl,report_url:rUrl.publicUrl,total_rides:trips.length,total_amount:totalAmt}),{headers:{...cors,"Content-Type":"application/json"}})
  }catch(e:any){
    console.error(e)
    return new Response(JSON.stringify({error:e.message||"Internal error"}),{status:500,headers:{...cors,"Content-Type":"application/json"}})
  }
})
