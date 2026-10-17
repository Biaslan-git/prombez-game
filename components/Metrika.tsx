"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { YM_ID } from "@/lib/metrika";

function Hits() {
  const pathname = usePathname();
  const search = useSearchParams();
  const first = useRef(true);
  useEffect(() => {
    // Первый хит отправляет init, дальше — переходы внутри SPA.
    if (first.current) {
      first.current = false;
      return;
    }
    const qs = search.toString();
    window.ym?.(YM_ID, "hit", pathname + (qs ? `?${qs}` : ""));
  }, [pathname, search]);
  return null;
}

export function Metrika() {
  if (!YM_ID) return null;
  return (
    <>
      <Script id="ym" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}","ym");try{window.ym(${YM_ID},"init",{webvisor:true,clickmap:true,trackLinks:true,accurateTrackBounce:true});}catch(e){}`}
      </Script>
      <Suspense fallback={null}>
        <Hits />
      </Suspense>
    </>
  );
}
