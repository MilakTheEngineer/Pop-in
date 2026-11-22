import {ImageResponse} from 'next/og';
export const alt='Varello — Good cuts. Better bookings.';
export const size={width:1200,height:630};
export const contentType='image/png';
export default function Image(){return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',padding:'90px',background:'#151024',color:'#FFF5F0',fontFamily:'sans-serif'}}><div style={{fontSize:46,fontWeight:700,marginBottom:50}}>Varello</div><div style={{display:'flex',flexDirection:'column',fontSize:80,fontWeight:800,lineHeight:1.1}}><span>Good cuts.</span><span>Better bookings.</span></div><div style={{width:160,height:10,marginTop:45,background:'linear-gradient(90deg, #FF4F91, #FF8B57)',borderRadius:8}}/></div>,size);}
