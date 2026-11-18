/* Progressive enhancement: scroll reveals, device-aware glass and subtle pointer parallax. */
(()=>{'use strict';
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
const fine=window.matchMedia('(hover: hover) and (pointer: fine)');
const small=window.matchMedia('(max-width: 767px)');
const targets=[...document.querySelectorAll('.proof,.features .section-intro,.feature-grid article,.pricing-title,.pricing-grid .plan,.faq-list article,.contact-copy,.contact-box,.form-card')];
let observer=null,frame=0;
function reset(){observer?.disconnect();observer=null;document.documentElement.classList.remove('pt-motion-ready');targets.forEach(el=>{el.removeAttribute('data-pt-reveal');el.classList.remove('pt-in-view');el.style.removeProperty('--pt-delay')});}
function init(){reset();if(reduce.matches||!('IntersectionObserver'in window))return;
targets.forEach((el,i)=>{el.setAttribute('data-pt-reveal','');el.style.setProperty('--pt-delay',String((i%4)*65)+'ms')});
observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('pt-in-view');observer.unobserve(entry.target)}})},{threshold:.08,rootMargin:'0px 0px -28px 0px'});
targets.forEach(el=>observer.observe(el));document.documentElement.classList.add('pt-motion-ready');
}
const progress=document.createElement('div');progress.className='pt-scroll-progress';progress.setAttribute('aria-hidden','true');document.body.append(progress);
function updateScroll(){frame=0;if(reduce.matches)return;const total=document.documentElement.scrollHeight-innerHeight;const ratio=total>0?Math.min(1,Math.max(0,scrollY/total)):0;document.documentElement.style.setProperty('--pt-scroll',ratio.toFixed(4))}
function onScroll(){if(!frame)frame=requestAnimationFrame(updateScroll)}
addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll,{passive:true});updateScroll();
const visual=document.querySelector('.visual');
if(visual){visual.addEventListener('pointermove',event=>{if(reduce.matches||!fine.matches||small.matches)return;const r=visual.getBoundingClientRect();const x=(event.clientX-r.left)/r.width,y=(event.clientY-r.top)/r.height;visual.style.setProperty('--pt-tilt-x',((x-.5)*5).toFixed(2)+'deg');visual.style.setProperty('--pt-tilt-y',((.5-y)*4).toFixed(2)+'deg');visual.style.setProperty('--pt-glow-x',(x*100).toFixed(1)+'%');visual.style.setProperty('--pt-glow-y',(y*100).toFixed(1)+'%')},{passive:true});visual.addEventListener('pointerleave',()=>{visual.style.removeProperty('--pt-tilt-x');visual.style.removeProperty('--pt-tilt-y');visual.style.removeProperty('--pt-glow-x');visual.style.removeProperty('--pt-glow-y')})}
reduce.addEventListener?.('change',()=>{init();onScroll()});init();
})();
