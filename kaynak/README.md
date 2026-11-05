# UmaCollector yarış motoru

`js/motor.worker.js` bu klasördeki kaynaktan derlenir. Dosya GNU GPL 3.0 or later lisanslıdır, lisans metni `LICENSE` dosyasında.

Hesabın kendisi alpha123'ün açık kaynak projelerine aittir:

- uma-tools: https://github.com/alpha123/uma-tools, commit `9c1d21e` (umalator-global verisi: course_data.json, skill_data.json, skill_meta.json, umas.json)
- uma-skill-tools: https://github.com/alpha123/uma-skill-tools, commit `8b3f5e2`

`compat/compare.ts` ve `compat/HorseDefTypes.ts`, uma-tools deposunda `1b8876b^` commit'indeki aynı adlı dosyalardır; yalnızca import yolları değiştirildi.

`src/motor.worker.ts` UmaCollector'ın köprü kodudur: sitenin gönderdiği iki Uma'yı motora verir, sonuçları ve medyan yarışın hız, HP ve skill kayıtlarını geri yollar.

## Derleme

```
git clone https://github.com/alpha123/uma-tools uma-tools        # 9c1d21e
git clone https://github.com/alpha123/uma-skill-tools uma-tools/uma-skill-tools   # 8b3f5e2
npm install
node build.mjs
```

Klasör düzeni: `build.mjs`, `src/`, `compat/` ve `uma-tools/` aynı klasörde olmalı.
