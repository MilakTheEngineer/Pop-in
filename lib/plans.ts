export const PLANS={
 free:{name:'Free',monthlyCents:0,locations:1,people:1,smsSegments:0,extraLocationCents:null},
 pro:{name:'Pro',monthlyCents:3900,locations:1,people:5,smsSegments:100,extraLocationCents:null},
 business:{name:'Business',monthlyCents:9900,locations:2,people:null,smsSegments:400,extraLocationCents:2500},
 founder:{name:'Founder',monthlyCents:0,locations:1,people:5,smsSegments:100,extraLocationCents:null,spots:3},
} as const;
export type PlanCode=keyof typeof PLANS;
