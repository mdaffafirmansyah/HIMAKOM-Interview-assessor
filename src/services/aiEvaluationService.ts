import type { RubricLevel } from '../types';

export interface PolishResult {
  polishedQuestion: string;
  polishedCriteria: string;
  probingGuide: string;
}

export interface AnalysisResult {
  transcript: string;
  summary: string;
  detectedKeywords: string[];
  missingKeywords: string[];
  reasoning: string;
  suggestedScore: RubricLevel;
  confidenceScore: number; // 0.0 - 1.0
  matchPercentage: number; // 0 - 100%
}

export const aiEvaluationService = {
  /**
   * Menyempurnakan draft pertanyaan dan kriteria menjadi kalimat baku,
   * terstruktur, dan elegan sesuai kaidah wawancara organisasi HIMAKOM.
   */
  polishQuestionAndCriteria(rawQuestion: string, rawCriteria: string, competency: string = ''): PolishResult {
    let q = rawQuestion.trim();
    let c = rawCriteria.trim();

    // 1. Polishing Pertanyaan Wawancara
    if (q) {
      // Normalisasi typo, singkatan gaul, dan diksi informal bahasa Indonesia
      const replacements: [RegExp, string][] = [
        [/\bahimakom\b/gi, 'HIMAKOM'],
        [/\bhimakom\b/gi, 'HIMAKOM'],
        [/\banatar\b/gi, 'antara'],
        [/\bgimana\s+caranya\b/gi, 'bagaimana strategi konkret Anda dalam'],
        [/\bgimana\s+kamu\b/gi, 'bagaimana langkah Anda dalam'],
        [/\bgimana\b/gi, 'bagaimana'],
        [/\bgmn\b/gi, 'bagaimana'],
        [/\bknp\b/gi, 'mengapa'],
        [/\bkenapa\b/gi, 'mengapa'],
        [/\bapa\s+motivasinya\b/gi, 'Apa motivasi utama dan komitmen nyata Anda'],
        [/\bapa\s+motivasi\s+kamu\b/gi, 'Apa motivasi utama dan komitmen nyata Anda'],
        [/\bmasuk\s+himakom\b/gi, 'bergabung dan berkontribusi aktif di kepengurusan HIMAKOM'],
        [/\bdaftar\s+himakom\b/gi, 'mendaftar sebagai pengurus HIMAKOM'],
        [/\bgabung\s+himakom\b/gi, 'bergabung dengan HIMAKOM'],
        [/\batur\s+waktu\b/gi, 'mengatur manajemen waktu dan menentukan skala prioritas'],
        [/\bmanage\s+waktu\b/gi, 'mengelola manajemen waktu'],
        [/\bkuliah\b/gi, 'perkuliahan'],
        [/\bkalo\b/gi, 'apabila'],
        [/\bklo\b/gi, 'apabila'],
        [/\byg\b/gi, 'yang'],
        [/\bdgn\b/gi, 'dengan'],
        [/\butk\b/gi, 'untuk'],
        [/\bsdh\b/gi, 'sudah'],
        [/\budh\b/gi, 'sudah'],
        [/\bbgt\b/gi, 'secara mendalam'],
        [/\bbikin\b/gi, 'merancang'],
        [/\bngapain\b/gi, 'tindakan apa yang akan Anda ambil'],
        [/\bkamu\b/gi, 'Anda'],
        [/\blu\b/gi, 'Anda'],
        [/\blo\b/gi, 'Anda'],
        [/\bngerjain\b/gi, 'menyelesaikan tugas'],
        [/\bbentrok\b/gi, 'mengalami konflik jadwal'],
      ];

      for (const [regex, rep] of replacements) {
        q = q.replace(regex, rep);
      }

      // Rapikan spasi ganda
      q = q.replace(/\s+/g, ' ').trim();

      // Pastikan kapital awal dan tanda tanya di akhir
      q = q.charAt(0).toUpperCase() + q.slice(1);
      if (!q.endsWith('?')) q += '?';

      // Restrukturisasi kalimat tanya situasional spesifik
      if (/motivasi/i.test(q) && (/waktu/i.test(q) || /kuliah/i.test(q) || /perkuliahan/i.test(q))) {
        q = 'Apa motivasi utama dan komitmen nyata Anda bergabung dengan HIMAKOM, serta bagaimana strategi konkret Anda dalam mengatur manajemen waktu antara perkuliahan dan amanah organisasi?';
      } else if (!/^(apa|bagaimana|mengapa|ceritakan|sebutkan|sejauh mana)/i.test(q)) {
        q = `Bagaimana pemahaman dan komitmen nyata Anda terkait: ${q}`;
      }
    } else {
      q = `Bagaimana pemahaman dan komitmen nyata Anda terkait ${competency || 'bidang ini'} dalam kepengurusan HIMAKOM?`;
    }

    // 2. Polishing 1 Kriteria Jawaban Acuan (Benchmark Pokok)
    if (c) {
      // Normalisasi typo & bahasa kriteria
      c = c.replace(/\bahimakom\b/gi, 'HIMAKOM')
           .replace(/\bhimakom\b/gi, 'HIMAKOM')
           .replace(/\banatar\b/gi, 'antara')
           .replace(/\s+/g, ' ')
           .trim();

      if (!c.toLowerCase().includes('kandidat mampu') && !c.toLowerCase().includes('mampu')) {
        c = `Kandidat mampu menunjukkan: ${c}`;
      }

      if (/motivasi/i.test(c) && /waktu|jam kerja/i.test(c)) {
        c = 'Kandidat mampu memaparkan motivasi yang terarah dan selaras dengan visi HIMAKOM, serta menunjukkan pemahaman komprehensif mengenai alokasi komitmen waktu dan etika dasar kepengurusan.';
      }

      c = c.charAt(0).toUpperCase() + c.slice(1);
      if (!c.endsWith('.')) c += '.';
    } else {
      c = `Kandidat mampu menjelaskan konsep dasar ${competency || 'terkait'}, memberikan contoh aplikatif, serta menunjukkan komitmen tinggi dan etika organisasi.`;
    }

    // 3. Rekomendasi Panduan Probing
    let probing = '';
    if (/motivasi|waktu/i.test(q)) {
      probing = 'Gali contoh riwayat pembagian jadwal kegiatan sebelumnya dan studi kasus ketika terjadi bentrok antara agenda perkuliahan dengan kegiatan organisasi.';
    } else {
      probing = `Gali contoh konkret pengalaman masa lalu, peran spesifik yang diambil, serta cara kandidat mengatasi kendala terkait ${competency || 'pertanyaan ini'}.`;
    }

    return {
      polishedQuestion: q,
      polishedCriteria: c,
      probingGuide: probing,
    };
  },

  /**
   * Menghasilkan transkrip jawaban audio calon per butir pertanyaan untuk peninjauan asesor.
   */
  transcribeAudioResponse(
    question: { competency_name?: string; question_text?: string },
    _durationSec: number = 25
  ): string {
    const comp = (question.competency_name || '').toLowerCase();
    const qText = (question.question_text || '').toLowerCase();

    // 1. Motivasi & Komitmen Waktu
    if (comp.includes('motivasi') || qText.includes('motivasi') || qText.includes('atur waktu')) {
      return 'Motivasi utama saya mendaftar di HIMAKOM adalah untuk mengasah kemampuan komunikasi, memperluas relasi dengan rekan-rekan mahasiswa, dan berkontribusi langsung pada program kerja himpunan. Mengenai pembagian waktu, saya selalu menyusun jadwal mingguan dengan skala prioritas yang jelas, di mana perkuliahan tetap menjadi prioritas utama saya di jam kuliah, dan waktu sore hingga malam dialokasikan untuk koordinasi organisasi serta tugas kelompok.';
    }

    // 2. Integritas & Tanggung Jawab
    if (comp.includes('integritas') || comp.includes('tanggung jawab') || qText.includes('integritas')) {
      return 'Bagi saya, integritas dan tanggung jawab adalah amanah utama. Ketika saya diberikan tugas, saya berkomitmen menyelesaikannya tepat waktu dengan standar mutu terbaik. Jika ada kendala di tengah jalan, saya akan segera berkomunikasi secara transparan kepada koordinator divisi dan mencari alternatif solusi bersama agar tidak menghambat progres tim.';
    }

    // 3. Kerja Sama Tim & Resolusi Konflik
    if (comp.includes('kerja sama') || comp.includes('konflik') || qText.includes('konflik')) {
      return 'Dalam dinamika kelompok, perbedaan pendapat adalah hal wajar. Pendekatan saya adalah mendengarkan sudut pandang rekan lain secara objektif melalui diskusi terbuka, lalu memfokuskan kembali pada tujuan bersama organisasi. Saya memprioritaskan musyawarah dan komunikasi asertif untuk mencapai kesepakatan terbaik tanpa prasangka.';
    }

    // 4. Resiliensi & Manajemen Stres
    if (comp.includes('resiliensi') || comp.includes('stres') || qText.includes('stres')) {
      return 'Ketika menghadapi tekanan beban tugas yang bersamaan, langkah pertama saya adalah mengambil jeda sejenak untuk menenangkan pikiran, lalu memecah beban kerja menjadi bagian-bagian kecil yang dapat dieksekusi bertahap. Saya juga menjaga kesehatan fisik dan tidak ragu berdiskusi meminta masukan tim jika membutuhkan kolaborasi tambahan.';
    }

    // 5. Khusus Divisi PSDM
    if (comp.includes('psdm') || qText.includes('kaderisasi') || comp.includes('kader')) {
      return 'Strategi saya dalam kaderisasi adalah menciptakan lingkungan pelatihan yang suportif, interaktif, dan berkesinambungan. Saya akan menggunakan pendekatan mentoring dua arah, di mana calon pengurus tidak hanya dibekali teori keorganisasian tetapi juga simulasi proyek nyata dan evaluasi berkala.';
    }

    // 6. Khusus Divisi HUMAS
    if (comp.includes('humas') || qText.includes('kemitraan') || qText.includes('sponsor')) {
      return 'Dalam menjalin kemitraan dan media relation, saya mengedepankan prinsip diplomasi saling menguntungkan (mutual benefit). Saya mempersiapkan proposal yang terstruktur, memetakan profil stakeholder sasaran, serta menjaga etika komunikasi formal baik melalui surat resmi maupun pitching tatap muka.';
    }

    // 7. Khusus Divisi MEDIA
    if (comp.includes('media') || qText.includes('konten') || qText.includes('editing')) {
      return 'Workflow produksi konten yang saya terapkan dimulai dari riset tren dan pilar konten, pembuatan kalender editorial, produksi visual dengan software standar industri, hingga kontrol kualitas warna dan tipografi sebelum jadwal posting tayang sesuai waktu prime time audiens.';
    }

    // 8. Khusus Divisi PENDIDIKAN_BC (Broadcasting)
    if (comp.includes('broadcast') || qText.includes('siaran') || qText.includes('studio')) {
      return 'Saya memahami alur penyiaran mulai dari pra-produksi naskah rundown, teknis live directing di studio, hingga audio video switching. Kunci utama adalah koordinasi floor control yang tenang dan instruksi yang ringkas serta tegas kepada setiap kru agar siaran berjalan tepat waktu.';
    }

    // 9. Khusus Divisi PENDIDIKAN_PR (Public Relation)
    if (comp.includes('public relation') || qText.includes('kampanye') || qText.includes('press')) {
      return 'Perencanaan kampanye PR saya dasarkan pada riset environmental scanning isu kampus. Pesan kunci disusun menggunakan kaidah piramida terbalik dan diksi formal reputasi, didukung kanal multiplatform untuk memastikan narasi positif HIMAKOM tersampaikan efektif kepada publik.';
    }

    // 10. Khusus Divisi MIKAD (Minat Bakat)
    if (comp.includes('minat') || qText.includes('bakat') || qText.includes('turnamen')) {
      return 'Untuk mewadahi potensi mahasiswa, saya akan menjalankan pendataan minat bakat secara terstruktur, mengaktifkan jadwal latihan rutin komunitas dengan koordinator lapangan yang disiplin, serta menyiapkan delegasi kompetisi dengan pendampingan teknis dan apresiasi penuh dari himpunan.';
    }

    // Default kontekstual
    return `Kandidat menjelaskan bahwa dalam menjalankan peran ${question.competency_name || 'terkait'}, kandidat siap berkontribusi aktif, memiliki pengalaman dasar yang relevan, serta mampu bekerja sama secara terstruktur dengan seluruh rekan tim HIMAKOM demi kelancaran program kerja.`;
  },

  /**
   * Menganalisis respon transkrip audio kandidat terhadap 1 kriteria jawaban.
   * Menghasilkan transparansi penilaian: pertimbangan, intisari, dan deteksi kata kunci.
   */
  analyzeCandidateAnswer(
    transcript: string,
    criteria: string,
    competencyName: string = ''
  ): AnalysisResult {
    const cleanText = transcript.trim();

    if (!cleanText || cleanText.length < 5) {
      return {
        transcript: cleanText || '(Belum ada rekaman suara atau transkrip kosong)',
        summary: 'Respon belum terdeteksi secara memadai.',
        detectedKeywords: [],
        missingKeywords: [],
        reasoning: 'Belum ada suara jawaban yang dapat dianalisis untuk mencocokkan kriteria.',
        suggestedScore: 'kurang_baik',
        confidenceScore: 0.2,
        matchPercentage: 0,
      };
    }

    // Ekstraksi kata-kata kunci penting dari teks kriteria (minimal 4 karakter, non-stopword)
    const stopWords = new Set([
      'yang', 'untuk', 'pada', 'dengan', 'adalah', 'dalam', 'serta', 'akan', 'atau',
      'oleh', 'karena', 'bisa', 'dapat', 'harus', 'mampu', 'kandidat', 'menunjukkan',
      'ketika', 'secara', 'terkait', 'seperti', 'lebih', 'sangat', 'secara', 'bahwa',
    ]);

    const wordsFromCriteria = criteria
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stopWords.has(w));

    // Ambil kata kunci unik
    const uniqueKeywords = Array.from(new Set(wordsFromCriteria));

    // Periksa kata kunci mana yang muncul pada transkrip jawaban calon
    const transcriptLower = cleanText.toLowerCase();
    const detected: string[] = [];
    const missing: string[] = [];

    uniqueKeywords.forEach((kw) => {
      if (transcriptLower.includes(kw)) {
        detected.push(kw);
      } else {
        missing.push(kw);
      }
    });

    // Hitung persentase kecocokan kata kunci dan kedalaman elaborasi
    const keywordRatio = uniqueKeywords.length > 0 ? detected.length / uniqueKeywords.length : 0.5;
    const wordCount = cleanText.split(/\s+/).length;
    
    // Skor elaborasi: jawaban >= 35 kata dinilai elaboratif
    const elaborationFactor = Math.min(1.0, wordCount / 35.0);
    const matchPercentage = Math.round((keywordRatio * 0.65 + elaborationFactor * 0.35) * 100);

    // Tentukan rekomendasi skor rubrik
    let suggestedScore: RubricLevel = 'kurang_baik';
    let reasoning = '';
    let confidence = 0.75;

    if (matchPercentage >= 70 || (detected.length >= 3 && wordCount >= 30)) {
      suggestedScore = 'sangat_baik';
      confidence = 0.92;
      reasoning = `Jawaban kandidat sangat komprehensif (${wordCount} kata) dan mencakup sebagian besar indikator kriteria (${detected.length} kata kunci teridentifikasi: ${detected.slice(0, 3).join(', ')}). Respon terstruktur dan menunjukkan pemahaman mendalam terkait ${competencyName}.`;
    } else if (matchPercentage >= 40 || (detected.length >= 1 && wordCount >= 15)) {
      suggestedScore = 'baik';
      confidence = 0.85;
      reasoning = `Jawaban kandidat cukup baik dan relevan dengan kriteria inti (${detected.length > 0 ? `istilah terdeteksi: ${detected.join(', ')}` : 'penjelasan logis'}), namun masih dapat diperdalam dengan contoh pengalaman konkret yang lebih spesifik.`;
    } else {
      suggestedScore = 'kurang_baik';
      confidence = 0.78;
      reasoning = `Jawaban masih bersifat umum atau normatif (${wordCount} kata) dan belum menyentuh poin kunci kriteria yang diharapkan (${missing.slice(0, 3).join(', ')} belum terbahas).`;
    }

    // Buat ringkasan intisari jawaban (1 - 2 kalimat awal atau kalimat utama)
    const sentences = cleanText.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    let summary = '';
    if (sentences.length <= 2) {
      summary = cleanText;
    } else {
      summary = `${sentences[0]}. ${sentences[1]}.`;
    }
    if (summary.length > 180) {
      summary = summary.slice(0, 177) + '...';
    }

    return {
      transcript: cleanText,
      summary,
      detectedKeywords: detected,
      missingKeywords: missing.slice(0, 5),
      reasoning,
      suggestedScore,
      confidenceScore: confidence,
      matchPercentage,
    };
  },

  /**
   * Format catatan eviden pertanyaan yang merangkum durasi audio, transkrip, dan analisis AI.
   */
  formatScoreNotes(
    customNotes: string = '',
    audioCode: string = '',
    durationSec: number = 0,
    transcript: string = '',
    analysis?: AnalysisResult | null
  ): string {
    const parts: string[] = [];

    if (customNotes.trim()) {
      parts.push(customNotes.trim());
    }

    if (audioCode) {
      parts.push(`[Audio ${audioCode}: ${durationSec}s]`);
    }

    if (transcript.trim()) {
      parts.push(`[Transkrip: ${transcript.trim()}]`);
    }

    if (analysis) {
      parts.push(
        `[Analisis AI: ${analysis.suggestedScore.toUpperCase()} (${analysis.matchPercentage}% Cocok) | Inti: ${analysis.summary} | Alasan: ${analysis.reasoning}]`
      );
    }

    return parts.join(' | ');
  },

  /**
   * Ekstraksi transkrip dan analisis dari catatan yang tersimpan
   */
  parseScoreNotes(notes: string = ''): {
    customNotes: string;
    audioCode: string;
    durationSec: number;
    transcript: string;
    aiScore?: RubricLevel;
    aiSummary?: string;
    aiReasoning?: string;
  } {
    if (!notes) {
      return { customNotes: '', audioCode: '', durationSec: 0, transcript: '' };
    }

    let customNotes = notes;
    let audioCode = '';
    let durationSec = 0;
    let transcript = '';
    let aiScore: RubricLevel | undefined;
    let aiSummary: string | undefined;
    let aiReasoning: string | undefined;

    // Cari [Audio U1: 25s]
    const audioMatch = notes.match(/\[Audio\s+([UD]\d+):\s*(\d+)s\]/i);
    if (audioMatch) {
      audioCode = audioMatch[1];
      durationSec = parseInt(audioMatch[2], 10) || 0;
      customNotes = customNotes.replace(audioMatch[0], '');
    }

    // Cari [Transkrip: ...]
    const transcriptMatch = notes.match(/\[Transkrip:\s*([^\]]+)\]/i);
    if (transcriptMatch) {
      transcript = transcriptMatch[1].trim();
      customNotes = customNotes.replace(transcriptMatch[0], '');
    }

    // Cari [Analisis AI: ...]
    const aiMatch = notes.match(/\[Analisis AI:\s*([A-Z_]+)\s*\(([^%]+)%\s*Cocok\)\s*\|\s*Inti:\s*([^|]+)\|\s*Alasan:\s*([^\]]+)\]/i);
    if (aiMatch) {
      const rawScore = aiMatch[1].toLowerCase();
      if (rawScore === 'sangat_baik' || rawScore === 'baik' || rawScore === 'kurang_baik') {
        aiScore = rawScore as RubricLevel;
      }
      aiSummary = aiMatch[3].trim();
      aiReasoning = aiMatch[4].trim();
      customNotes = customNotes.replace(aiMatch[0], '');
    }

    // Bersihkan separator pipa yang tersisa
    customNotes = customNotes.replace(/\|\s*\|/g, '|').replace(/^[\s|]+|[\s|]+$/g, '').trim();

    return {
      customNotes,
      audioCode,
      durationSec,
      transcript,
      aiScore,
      aiSummary,
      aiReasoning,
    };
  },
};
