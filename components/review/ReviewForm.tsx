"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StarRating from "./StarRating";
import { reviewCategories } from "./reviewCategories";

const issueOptions=[
"Deposit Delay","Deposit Deduction","Hidden Charges","Water Issues","Power Issues","Noise","Parking","Safety","Owner Behaviour","Maintenance","Broker Issues","Pet Restrictions","Other"];

export default function ReviewForm(){
const [ratings,setRatings]=useState<Record<string,number>>({});
const [issues,setIssues]=useState<string[]>([]);
const router = useRouter();

const toggleIssue=(i:string)=>setIssues(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i]);

return (
<div className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-lg">
<h1 className="text-4xl font-bold text-gray-900">Share Your Experience</h1>
<p className="mt-2 text-gray-600">Help future tenants by sharing your honest experience.</p>

<div className="mt-8 space-y-5">
{reviewCategories.map(c=>(
<StarRating key={c.id} label={c.label} value={ratings[c.id]??0} onChange={(v)=>setRatings({...ratings,[c.id]:v})}/>
))}
</div>

<div className="mt-8">
<label className="block mb-2 font-semibold text-gray-900">Review Title</label>
<input className="w-full rounded-xl border p-3 text-gray-900" placeholder="Deposit returned within 10 days"/>
</div>

<div className="mt-6">
<label className="block mb-2 font-semibold text-gray-900">Share Your Experience</label>
<textarea rows={6} className="w-full rounded-xl border p-3 text-gray-900" placeholder="Tell future tenants what went well..." />
</div>

<div className="mt-8 grid gap-6 md:grid-cols-2">
<input className="rounded-xl border p-3 text-gray-900" placeholder="Monthly Rent"/>
<input className="rounded-xl border p-3 text-gray-900" placeholder="Security Deposit"/>
</div>

<div className="mt-8">
<h2 className="font-semibold text-gray-900 mb-3">Would you recommend this property?</h2>
<label className="mr-4"><input type="radio" name="r"/> Yes</label>
<label className="mr-4"><input type="radio" name="r"/> Maybe</label>
<label><input type="radio" name="r"/> No</label>
</div>

<div className="mt-8">
<h2 className="font-semibold text-gray-900 mb-3">Problems Experienced</h2>
<div className="grid gap-2 md:grid-cols-2">
{issueOptions.map(i=>(
<label key={i} className="text-gray-800">
<input className="mr-2" type="checkbox" checked={issues.includes(i)} onChange={()=>toggleIssue(i)}/>
{i}
</label>
))}
</div>
</div>

<div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-5">
<h2 className="font-semibold text-gray-900">Current Verification Status</h2>
<p className="mt-2 text-gray-700">⚪ Unverified</p>
<p className="text-sm text-gray-600 mt-2">You can verify later by uploading supporting documents.</p>
</div>

<button
  type="button"
  onClick={() => {
    router.push(window.location.pathname + "/success");
  }}
  className="mt-10 w-full rounded-xl bg-[#1B4332] py-4 text-white font-semibold hover:bg-[#2D6A4F]"
>
  Publish My Experience
</button>
</div>
);
}
