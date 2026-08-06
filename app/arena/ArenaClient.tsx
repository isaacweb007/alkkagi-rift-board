"use client";

import dynamic from "next/dynamic";

const AlkkagiArena = dynamic(() => import("./AlkkagiArena"), {
  ssr: false,
  loading: () => (
    <main className="arena-app arena-modern arena-loading" aria-label="3D 알까기 경기장 로딩 중">
      <div className="arena-danger-backdrop" />
      <div className="arena-vignette" />
      <section className="arena-lobby">
        <div className="engine-badge"><i /> BROWSER 3D ENGINE <small>LOADING</small></div>
        <h1>심연의 판을<br /><em>불러오는 중.</em></h1>
        <p>고해상도 캐릭터와 물리 엔진을 브라우저에서 안전하게 준비하고 있습니다.</p>
      </section>
    </main>
  ),
});

export default function ArenaClient() {
  return <AlkkagiArena />;
}
