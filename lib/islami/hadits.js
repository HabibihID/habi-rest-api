// lib/islami/hadits.js — Hadits Arba'in An-Nawawi (HABI REST API)
// Bank lokal: 21 hadits pilihan dari Al-Arba'in An-Nawawiyah (Imam An-Nawawi)
// dengan terjemahan Bahasa Indonesia yang beredar luas. Tanpa API luar.
// Tema dipakai untuk pencarian (.hadits cari <kata>).

export const HADITS = [
  {
    no: 1, tema: ['niat', 'ikhlas', 'amal'],
    arab: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى اللهِ وَرَسُوْلِهِ فَهِجْرَتُهُ إِلَى اللهِ وَرَسُوْلِهِ، وَمَنْ كَانَتْ هِجْرَتُهُ لِدُنْيَا يُصِيْبُهَا أَوِ امْرَأَةٍ يَنْكِحُهَا فَهِجْرَتُهُ إِلَى مَا هَاجَرَ إِلَيْهِ',
    arti: 'Sesungguhnya setiap amalan tergantung pada niatnya. Setiap orang akan mendapatkan apa yang ia niatkan. Siapa yang hijrahnya karena Allah dan Rasul-Nya, maka hijrahnya untuk Allah dan Rasul-Nya. Siapa yang hijrahnya karena mencari dunia atau karena seorang wanita yang hendak dinikahinya, maka hijrahnya kepada apa yang ia tuju.',
    sumber: 'HR. Bukhari dan Muslim',
  },
  {
    no: 3, tema: ['islam', 'rukun islam', 'shalat', 'puasa', 'zakat', 'haji'],
    arab: 'بُنِيَ الإِسْلاَمُ عَلَى خَمْسٍ: شَهَادَةِ أَنْ لاَ إِلَهَ إِلاَّ اللهُ وَأَنَّ مُحَمَّدًا رَسُوْلُ اللهِ، وَإِقَامِ الصَّلاَةِ، وَإِيْتَاءِ الزَّكَاةِ، وَحَجِّ البَيْتِ، وَصَوْمِ رَمَضَانَ',
    arti: 'Islam dibangun di atas lima perkara: bersaksi bahwa tidak ada ilah (sesembahan) yang berhak disembah selain Allah dan Muhammad adalah utusan Allah, mendirikan shalat, menunaikan zakat, haji ke Baitullah, dan puasa Ramadhan.',
    sumber: 'HR. Bukhari dan Muslim',
  },
  {
    no: 5, tema: ['bidah', 'sunnah', 'amal'],
    arab: 'مَنْ أَحْدَثَ فِي أَمْرِنَا هَذَا مَا لَيْسَ مِنْهُ فَهُوَ رَدٌّ',
    arti: 'Siapa yang membuat perkara baru dalam urusan (agama) kami ini yang bukan berasal darinya, maka perkara tersebut tertolak.',
    sumber: 'HR. Bukhari dan Muslim',
  },
  {
    no: 6, tema: ['halal', 'haram', 'syubhat', 'hati'],
    arab: 'إِنَّ الحَلاَلَ بَيِّنٌ وَإِنَّ الحَرَامَ بَيِّنٌ، وَبَيْنَهُمَا مُشْتَبِهَاتٌ لاَ يَعْلَمُهُنَّ كَثِيْرٌ مِنَ النَّاسِ، فَمَنِ اتَّقَى الشُّبُهَاتِ فَقَدِ اسْتَبْرَأَ لِدِيْنِهِ وَعِرْضِهِ',
    arti: 'Sesungguhnya yang halal itu jelas dan yang haram itu jelas. Di antara keduanya terdapat perkara-perkara syubhat (samar) yang tidak diketahui oleh kebanyakan manusia. Siapa yang menghindarkan diri dari syubhat, maka ia telah membersihkan agama dan kehormatannya.',
    sumber: 'HR. Bukhari dan Muslim',
  },
  {
    no: 7, tema: ['nasihat', 'agama'],
    arab: 'الدِّيْنُ النَّصِيْحَةُ. قُلْنَا: لِمَنْ؟ قَالَ: لِلَّهِ وَلِكِتَابِهِ وَلِرَسُوْلِهِ وَلِأَئِمَّةِ الْمُسْلِمِيْنَ وَعَامَّتِهِمْ',
    arti: 'Agama adalah nasihat. Kami bertanya: Untuk siapa? Beliau menjawab: Untuk Allah, kitab-Nya, Rasul-Nya, para pemimpin kaum muslimin, dan seluruh kaum muslimin.',
    sumber: 'HR. Muslim',
  },
  {
    no: 11, tema: ['ragu', 'tenang', 'syubhat'],
    arab: 'دَعْ مَا يَرِيْبُكَ إِلَى مَا لاَ يَرِيْبُكَ',
    arti: 'Tinggalkanlah apa yang meragukanmu menuju apa yang tidak meragukanmu.',
    sumber: 'HR. Tirmidzi dan An-Nasa\'i',
  },
  {
    no: 12, tema: ['waktu', 'bermanfaat', 'islam'],
    arab: 'مِنْ حُسْنِ إِسْلاَمِ الْمَرْءِ تَرْكُهُ مَا لاَ يَعْنِيْهِ',
    arti: 'Di antara tanda kebaikan Islam seseorang adalah meninggalkan hal yang tidak bermanfaat baginya.',
    sumber: 'HR. Tirmidzi',
  },
  {
    no: 13, tema: ['iman', 'saudara', 'cinta'],
    arab: 'لاَ يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لأَخِيْهِ مَا يُحِبُّ لِنَفْسِهِ',
    arti: 'Tidak beriman salah seorang di antara kalian sampai ia mencintai saudaranya sebagaimana ia mencintai dirinya sendiri.',
    sumber: 'HR. Bukhari dan Muslim',
  },
  {
    no: 15, tema: ['lisan', 'tetangga', 'tamu', 'diam'],
    arab: 'مَنْ كَانَ يُؤْمِنُ بِاللهِ وَاليَوْمِ الآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ، وَمَنْ كَانَ يُؤْمِنُ بِاللهِ وَاليَوْمِ الآخِرِ فَلْيُكْرِمْ جَارَهُ، وَمَنْ كَانَ يُؤْمِنُ بِاللهِ وَاليَوْمِ الآخِرِ فَلْيُكْرِمْ ضَيْفَهُ',
    arti: 'Siapa yang beriman kepada Allah dan hari akhir, hendaklah ia berkata baik atau diam. Siapa yang beriman kepada Allah dan hari akhir, hendaklah ia memuliakan tetangganya. Siapa yang beriman kepada Allah dan hari akhir, hendaklah ia memuliakan tamunya.',
    sumber: 'HR. Bukhari dan Muslim',
  },
  {
    no: 16, tema: ['marah', 'emosi', 'sabar'],
    arab: 'لاَ تَغْضَبْ',
    arti: 'Janganlah engkau marah. (Jawaban Rasulullah ﷺ kepada seseorang yang meminta nasihat, dan beliau mengulanginya berkali-kali.)',
    sumber: 'HR. Bukhari',
  },
  {
    no: 18, tema: ['takwa', 'akhlak', 'taubat'],
    arab: 'اتَّقِ اللهَ حَيْثُمَا كُنْتَ، وَأَتْبِعِ السَّيِّئَةَ الحَسَنَةَ تَمْحُهَا، وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ',
    arti: 'Bertakwalah kepada Allah di mana pun engkau berada. Iringilah keburukan dengan kebaikan, niscaya kebaikan itu akan menghapusnya. Dan bergaullah dengan manusia dengan akhlak yang baik.',
    sumber: 'HR. Tirmidzi',
  },
  {
    no: 19, tema: ['tawakal', 'doa', 'takdir', 'pertolongan'],
    arab: 'احْفَظِ اللهَ يَحْفَظْكَ، احْفَظِ اللهَ تَجِدْهُ تُجَاهَكَ، إِذَا سَأَلْتَ فَاسْأَلِ اللهَ، وَإِذَا اسْتَعَنْتَ فَاسْتَعِنْ بِاللهِ',
    arti: 'Jagalah (hak) Allah, niscaya Allah akan menjagamu. Jagalah (hak) Allah, niscaya engkau akan mendapati-Nya di hadapanmu. Jika engkau meminta, mintalah kepada Allah. Jika engkau memohon pertolongan, mohonlah pertolongan kepada Allah.',
    sumber: 'HR. Tirmidzi',
  },
  {
    no: 20, tema: ['malu', 'iman'],
    arab: 'إِنَّ مِمَّا أَدْرَكَ النَّاسُ مِنْ كَلاَمِ النُّبُوَّةِ الأُوْلَى: إِذَا لَمْ تَسْتَحِ فَاصْنَعْ مَا شِئْتَ',
    arti: 'Sesungguhnya di antara perkataan kenabian terdahulu yang masih didapati manusia adalah: Jika engkau tidak malu, berbuatlah sesukamu.',
    sumber: 'HR. Bukhari',
  },
  {
    no: 23, tema: ['suci', 'shalat', 'sedekah', 'sabar', 'quran'],
    arab: 'الطُّهُوْرُ شَطْرُ الإِيْمَانِ، وَالحَمْدُ لِلَّهِ تَمْلَأُ الْمِيْزَانَ، وَسُبْحَانَ اللهِ وَالحَمْدُ لِلَّهِ تَمْلَآنِ مَا بَيْنَ السَّمَاوَاتِ وَالأَرْضِ، وَالصَّلاَةُ نُوْرٌ، وَالصَّدَقَةُ بُرْهَانٌ، وَالصَّبْرُ ضِيَاءٌ، وَالقُرْآنُ حُجَّةٌ لَكَ أَوْ عَلَيْكَ',
    arti: 'Kesucian adalah sebagian dari iman. Alhamdulillah memenuhi timbangan. Subhanallah dan Alhamdulillah memenuhi ruangan antara langit dan bumi. Shalat adalah cahaya, sedekah adalah bukti, sabar adalah pelita, dan Al-Qur\'an adalah hujjah (pembela) bagimu atau bumerang atasmu.',
    sumber: 'HR. Muslim',
  },
  {
    no: 31, tema: ['zuhud', 'dunia', 'cinta'],
    arab: 'ازْهَدْ فِي الدُّنْيَا يُحِبَّكَ اللهُ، وَازْهَدْ فِيْمَا عِنْدَ النَّاسِ يُحِبَّكَ النَّاسُ',
    arti: 'Zuhudlah terhadap dunia, niscaya Allah akan mencintaimu. Dan zuhudlah terhadap apa yang dimiliki manusia, niscaya manusia akan mencintaimu.',
    sumber: 'HR. Ibnu Majah',
  },
  {
    no: 32, tema: ['mudarat', 'bahaya', 'sesama'],
    arab: 'لاَ ضَرَرَ وَلاَ ضِرَارَ',
    arti: 'Tidak boleh membuat mudarat (bahaya) bagi diri sendiri maupun bagi orang lain.',
    sumber: 'HR. Ibnu Majah dan Ad-Daruquthni',
  },
  {
    no: 34, tema: ['kemungkaran', 'amar makruf', 'iman'],
    arab: 'مَنْ رَأَى مِنْكُمْ مُنْكَرًا فَلْيُغَيِّرْهُ بِيَدِهِ، فَإِنْ لَمْ يَسْتَطِعْ فَبِلِسَانِهِ، فَإِنْ لَمْ يَسْتَطِعْ فَبِقَلْبِهِ، وَذَلِكَ أَضْعَفُ الإِيْمَانِ',
    arti: 'Siapa di antara kalian yang melihat kemungkaran, hendaklah ia mengubahnya dengan tangannya. Jika tidak mampu, maka dengan lisannya. Jika tidak mampu juga, maka dengan hatinya — dan itu adalah selemah-lemahnya iman.',
    sumber: 'HR. Muslim',
  },
  {
    no: 35, tema: ['dengki', 'saudara', 'muslim'],
    arab: 'لاَ تَحَاسَدُوْا، وَلاَ تَنَاجَشُوْا، وَلاَ تَبَاغَضُوْا، وَلاَ تَدَابَرُوْا، وَكُوْنُوْا عِبَادَ اللهِ إِخْوَانًا. الْمُسْلِمُ أَخُو الْمُسْلِمِ، لاَ يَظْلِمُهُ وَلاَ يَخْذُلُهُ وَلاَ يَكْذِبُهُ وَلاَ يَحْقِرُهُ',
    arti: 'Janganlah kalian saling dengki, saling menipu dalam jual beli, saling membenci, dan saling membelakangi. Jadilah kalian hamba-hamba Allah yang bersaudara. Seorang muslim adalah saudara bagi muslim lainnya: tidak menzaliminya, tidak menelantarkannya, tidak mendustainya, dan tidak merendahkannya.',
    sumber: 'HR. Bukhari dan Muslim',
  },
  {
    no: 36, tema: ['menolong', 'ilmu', 'kesulitan', 'sesama'],
    arab: 'مَنْ نَفَّسَ عَنْ مُؤْمِنٍ كُرْبَةً مِنْ كُرَبِ الدُّنْيَا، نَفَّسَ اللهُ عَنْهُ كُرْبَةً مِنْ كُرَبِ يَوْمِ القِيَامَةِ. وَمَنْ يَسَّرَ عَلَى مُعْسِرٍ، يَسَّرَ اللهُ عَلَيْهِ فِي الدُّنْيَا وَالآخِرَةِ. وَاللهُ فِي عَوْنِ العَبْدِ مَا كَانَ العَبْدُ فِي عَوْنِ أَخِيْهِ',
    arti: 'Siapa yang melapangkan satu kesulitan dunia seorang mukmin, Allah akan melapangkan baginya satu kesulitan di hari kiamat. Siapa yang memudahkan urusan orang yang kesulitan, Allah akan memudahkannya di dunia dan akhirat. Allah senantiasa menolong seorang hamba selama hamba itu menolong saudaranya.',
    sumber: 'HR. Muslim',
  },
  {
    no: 40, tema: ['dunia', 'zuhud', 'akhirat'],
    arab: 'كُنْ فِي الدُّنْيَا كَأَنَّكَ غَرِيْبٌ أَوْ عَابِرُ سَبِيْلٍ',
    arti: 'Jadilah engkau di dunia ini seolah-olah orang asing atau seorang pengembara (yang sekadar lewat).',
    sumber: 'HR. Bukhari',
  },
  {
    no: 42, tema: ['ampunan', 'doa', 'taubat', 'rahmat'],
    arab: 'يَا ابْنَ آدَمَ، إِنَّكَ مَا دَعَوْتَنِي وَرَجَوْتَنِي غَفَرْتُ لَكَ عَلَى مَا كَانَ فِيْكَ وَلاَ أُبَالِي. يَا ابْنَ آدَمَ، لَوْ بَلَغَتْ ذُنُوْبُكَ عَنَانَ السَّمَاءِ ثُمَّ اسْتَغْفَرْتَنِي غَفَرْتُ لَكَ وَلاَ أُبَالِي',
    arti: 'Wahai anak Adam, sesungguhnya selama engkau berdoa dan berharap kepada-Ku, Aku akan mengampunimu atas segala dosa yang ada padamu dan Aku tidak peduli (seberapa banyaknya). Wahai anak Adam, seandainya dosa-dosamu mencapai awan di langit kemudian engkau memohon ampun kepada-Ku, niscaya Aku akan mengampunimu dan Aku tidak peduli.',
    sumber: 'HR. Tirmidzi (hadits qudsi)',
  },
]

export function randomHadits() {
  return HADITS[Math.floor(Math.random() * HADITS.length)]
}

export function haditsByNo(no) {
  return HADITS.find((h) => h.no === Number(no)) || null
}

export function cariHadits(q = '') {
  const s = String(q).toLowerCase().trim()
  if (!s) return []
  return HADITS.filter((h) => h.tema.some((t) => t.includes(s)) || h.arti.toLowerCase().includes(s)).slice(0, 5)
}

export default { HADITS, randomHadits, haditsByNo, cariHadits }
