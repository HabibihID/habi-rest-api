// getKisahNabi — Bank lokal 25 nabi & rasul.
// Ditulis dari nol untuk HABI REST API. Tidak ada API luar, tidak ada key.

const NABI = [
  {
    nama: 'Adam',
    umur: '±1000 tahun',
    mukjizat: 'Diberi ilmu tentang nama-nama segala sesuatu, menjadi khalifah pertama di bumi.',
    kisah: 'Adam adalah manusia pertama sekaligus nabi pertama. Allah menciptakannya dari tanah, meniupkan ruh ke dalamnya, lalu memerintahkan para malaikat untuk sujud kepadanya. Bersama Hawa, ia diturunkan ke bumi dan menjadi bapak seluruh umat manusia.'
  },
  {
    nama: 'Idris',
    umur: '±365 tahun',
    mukjizat: 'Nabi pertama yang pandai menulis dengan pena dan menguasai ilmu astronomi (perbintangan) serta menjahit.',
    kisah: 'Idris diutus kepada keturunan Qabil yang mulai menyimpang dari ajaran tauhid. Ia gigih berdakwah dan mengajarkan ilmu pengetahuan. Allah mengangkat derajatnya ke tempat yang tinggi karena kesabaran dan ketakwaannya.'
  },
  {
    nama: 'Nuh',
    umur: '950 tahun masa dakwah',
    mukjizat: 'Membuat bahtera raksasa yang menyelamatkan kaum beriman dari banjir besar.',
    kisah: 'Nuh berdakwah selama 950 tahun kepada kaumnya yang menyembah berhala, namun hanya sedikit yang beriman. Atas perintah Allah, ia membangun bahtera dan menaikkan orang-orang beriman beserta hewan berpasangan. Banjir besar menenggelamkan kaum kafir, termasuk anaknya sendiri yang menolak naik ke kapal.'
  },
  {
    nama: 'Hud',
    umur: 'Tidak diketahui pasti (±150 tahun)',
    mukjizat: 'Tetap selamat saat badai dahsyat yang membinasakan kaumnya.',
    kisah: 'Hud diutus kepada kaum \'Ad yang kuat secara fisik tetapi sombong dan menyembah berhala. Ia menyeru mereka untuk bertakwa dan bertobat, namun mereka mendustakannya. Allah kemudian menurunkan angin topan yang membinasakan seluruh kaum \'Ad yang kafir, sedangkan Hud dan pengikutnya diselamatkan.'
  },
  {
    nama: 'Shalih',
    umur: 'Tidak diketahui pasti',
    mukjizat: 'Unta betina yang keluar dari batu besar sebagai bukti kenabiannya.',
    kisah: 'Shalih diutus kepada kaum Tsamud yang terkenal mampu memahat rumah di gunung batu. Sebagai bukti, Allah mengeluarkan seekor unta betina dari batu besar atas permintaan kaumnya. Mereka lalu membunuh unta tersebut, maka Allah menimpakan azab gempa dan petir yang memusnahkan mereka.'
  },
  {
    nama: 'Ibrahim',
    umur: '±175 tahun',
    mukjizat: 'Tidak terbakar saat dilemparkan ke api oleh Raja Namrud; membangun Ka\'bah bersama Ismail.',
    kisah: 'Ibrahim adalah bapak para nabi (Abu al-Anbiya). Ia menghancurkan berhala-berhala kaumnya hingga dilemparkan ke api oleh Raja Namrud, namun api menjadi dingin dan menyelamatkan. Ia kemudian diperintah membangun Ka\'bah di Mekah bersama putranya, Ismail, dan mengajarkan manasik haji.'
  },
  {
    nama: 'Luth',
    umur: 'Tidak diketahui pasti',
    mukjizat: 'Diselamatkan dari azab yang menimpa kaumnya pada malam hari sebelum azab datang.',
    kisah: 'Luth adalah keponakan Ibrahim, diutus kepada kaum Sodom yang melakukan perbuatan keji (homoseksual) yang belum pernah dilakukan umat sebelumnya. Setelah berkali-kali memperingatkan, Allah menurunkan azab hujan batu dan membalikkan negeri mereka. Luth dan pengikutnya keluar sebelum azab tiba.'
  },
  {
    nama: 'Ismail',
    umur: '137 tahun',
    mukjizat: 'Memancar air zamzam dari hentakan kakinya saat masih bayi; tidak terbunuh saat disembelih ayahnya.',
    kisah: 'Ismail adalah putra Ibrahim dari Hajar. Saat masih bayi, ia ditinggalkan di lembah Mekah yang tandus; dari hentakan kakinya memancarlah air zamzam. Ketika remaja, ia rela disembelih ayahnya sebagai ujian, lalu Allah menggantinya dengan seekor sembelihan besar — inilah asal ibadah kurban.'
  },
  {
    nama: 'Ishak',
    umur: '180 tahun',
    mukjizat: 'Dikaruniai putra (Yakub) di usia sangat tua dari istri yang mandul.',
    kisah: 'Ishak adalah putra kedua Ibrahim dari Sarah, lahir saat keduanya sudah sangat tua sebagai anugerah Allah. Ia meneruskan dakwah ayahnya kepada kaum Kan\'an dan menjadi leluhur para nabi Bani Israil melalui putranya, Yakub.'
  },
  {
    nama: 'Yakub',
    umur: '147 tahun',
    mukjizat: 'Kedua belas putranya menjadi cikal bakal dua belas suku Bani Israil.',
    kisah: 'Yakub (dikenal juga sebagai Israil) adalah putra Ishak. Ia memiliki dua belas putra, di antaranya Yusuf. Ia sangat sabar menghadapi kehilangan Yusuf dan ujian lainnya. Melalui keturunannya, Allah membentuk bangsa Bani Israil yang menjadi asal banyak nabi setelahnya.'
  },
  {
    nama: 'Yusuf',
    umur: '110 tahun',
    mukjizat: 'Mampu menakwilkan mimpi dengan tepat; ketampanan luar biasa.',
    kisah: 'Yusuf adalah putra kesayangan Yakub. Ia difitnah saudara-saudaranya, dibuang ke sumur, dijual sebagai budak, lalu difitnah hingga dipenjara di Mesir. Di penjara ia menakwilkan mimpi hingga akhirnya diangkat menjadi bendahara Mesir dan menyelamatkan negeri dari paceklik. Ia terkenal memaafkan saudara-saudaranya.'
  },
  {
    nama: 'Ayyub',
    umur: '±93 tahun',
    mukjizat: 'Disembuhkan dari penyakit bertahun-tahun setelah bersabar; keluarganya dikembalikan dua kali lipat.',
    kisah: 'Ayyub adalah simbol kesabaran dalam ujian. Ia kehilangan harta, anak-anak, dan kesehatannya dalam ujian berat, namun tetap bersabar dan tidak mengeluh kepada Allah. Setelah bertahun-tahun sakit, ia sembuh atas izin Allah dan keadaannya dipulihkan lebih baik dari sebelumnya.'
  },
  {
    nama: 'Syuaib',
    umur: 'Tidak diketahui pasti',
    mukjizat: 'Diselamatkan dari gempa dahsyat yang membinasakan kaumnya.',
    kisah: 'Syuaib diutus kepada kaum Madyan yang terkenal curang dalam takaran dan timbangan. Ia menyeru mereka agar jujur berdagang dan menyembah Allah semata. Kaumnya menolak dan mengancam mengusirnya, hingga Allah menimpakan azab gempa dahsyat yang memusnahkan mereka.'
  },
  {
    nama: 'Musa',
    umur: '120 tahun',
    mukjizat: 'Tongkat menjadi ular, membelah Laut Merah, menerima Taurat; tangan bercahaya.',
    kisah: 'Musa diutus kepada Bani Israil yang diperbudak Fir\'aun di Mesir. Dengan mukjizat tongkat dan berbagai tanda, ia menantang Fir\'aun hingga akhirnya membawa kaumnya keluar Mesir dengan membelah Laut Merah — Fir\'aun dan pasukannya tenggelam. Ia menerima kitab Taurat di Bukit Tursina.'
  },
  {
    nama: 'Harun',
    umur: '123 tahun',
    mukjizat: 'Dikaruniai kefasihan berbicara untuk membantu dakwah Musa.',
    kisah: 'Harun adalah kakak kandung Musa. Karena Musa merasa kurang fasih berbicara, Allah mengangkat Harun sebagai nabi pendamping untuk membantunya menghadapi Fir\'aun. Ia juga dipercaya memimpin Bani Israil saat Musa bermunajat di Bukit Tursina.'
  },
  {
    nama: 'Zulkifli',
    umur: '±75 tahun',
    mukjizat: 'Dikenal karena kesabaran luar biasa dan selalu menepati janji.',
    kisah: 'Zulkifli adalah nabi yang terkenal karena kesabaran dan keteguhannya menepati janji, bahkan saat marah sekalipun. Ia meneruskan dakwah di kalangan Bani Israil setelah Nabi Ilyasa. Namanya diabadikan dalam Al-Qur\'an sebagai teladan orang-orang yang sabar.'
  },
  {
    nama: 'Daud',
    umur: '100 tahun',
    mukjizat: 'Diberi kitab Zabur; besi menjadi lunak di tangannya; gunung dan burung ikut bertasbih bersamanya.',
    kisah: 'Daud adalah raja sekaligus nabi Bani Israil. Ia terkenal mengalahkan raksasa Jalut dengan ketapel saat masih muda. Allah memberinya kitab Zabur dan suara yang sangat merdu, serta menjadikannya hakim yang adil. Ia juga pandai membuat baju besi.'
  },
  {
    nama: 'Sulaiman',
    umur: '±60 tahun',
    mukjizat: 'Memahami bahasa binatang, menundukkan jin dan angin, memerintah atas kerajaan megah.',
    kisah: 'Sulaiman adalah putra Daud yang diwarisi kerajaan dan kenabian. Allah memberinya mukjizat memahami bahasa semut dan burung, menundukkan jin untuk membangun istana, dan menundukkan angin. Kisahnya dengan Ratu Balqis dari Saba\' menjadi bukti kebesaran kerajaannya.'
  },
  {
    nama: 'Ilyas',
    umur: 'Tidak diketahui pasti (diangkat Allah)',
    mukjizat: 'Doanya mustajab — memohon hujan dan kemarau kepada Allah.',
    kisah: 'Ilyas diutus kepada kaumnya di Baalbek yang menyembah berhala bernama Ba\'al. Ia memperingatkan mereka agar bertakwa, namun didustakan. Atas doanya, Allah menahan hujan hingga kaumnya mengalami paceklik sebagai peringatan.'
  },
  {
    nama: 'Ilyasa',
    umur: 'Tidak diketahui pasti',
    mukjizat: 'Meneruskan risalah Ilyas dengan keteguhan hati.',
    kisah: 'Ilyasa adalah murid dan penerus Nabi Ilyas. Ia diangkat menjadi nabi untuk meneruskan dakwah kepada Bani Israil setelah Ilyas diangkat Allah. Ia berdakwah dengan penuh kesabaran mengikuti jejak gurunya.'
  },
  {
    nama: 'Yunus',
    umur: 'Tidak diketahui pasti',
    mukjizat: 'Tetap hidup di dalam perut ikan paus (nun) selama beberapa waktu, lalu dikeluarkan dengan selamat.',
    kisah: 'Yunus diutus kepada penduduk Ninawa. Karena kecewa kaumnya tidak kunjung beriman, ia meninggalkan mereka tanpa izin Allah. Di tengah laut, ia ditelan ikan paus. Di dalam kegelapan perut ikan ia bertasbih, lalu Allah mengeluarkannya. Ia kembali dan seluruh kaumnya akhirnya beriman.'
  },
  {
    nama: 'Zakaria',
    umur: 'Tidak diketahui pasti',
    mukjizat: 'Dikaruniai putra (Yahya) di usia sangat tua dari istri yang mandul.',
    kisah: 'Zakaria adalah nabi dari Bani Israil yang menjadi pengasuh Maryam. Ia berdoa kepada Allah agar diberi keturunan di usia senjanya, lalu dikaruniai putra bernama Yahya. Ia dikenal sebagai nabi yang tekun beribadah dan mengasuh Maryam dengan penuh amanah.'
  },
  {
    nama: 'Yahya',
    umur: '±30 tahun (syahid di usia muda)',
    mukjizat: 'Diberi hikmah dan kitab sejak kecil; terjaga dari dosa sejak kanak-kanak.',
    kisah: 'Yahya adalah putra Zakaria yang lahir sebagai jawaban doa ayahnya di usia tua. Ia diberi kitab dan hikmah sejak kecil serta dikenal zuhud dan suci. Ia membenarkan kenabian Isa dan wafat sebagai syahid karena mempertahankan kebenaran di hadapan penguasa zalim.'
  },
  {
    nama: 'Isa',
    umur: '33 tahun (diangkat ke langit)',
    mukjizat: 'Lahir tanpa ayah; berbicara saat bayi; menyembuhkan kebutaan dan kusta; menghidupkan orang mati dengan izin Allah; diberi kitab Injil.',
    kisah: 'Isa adalah putra Maryam yang lahir tanpa ayah atas kehendak Allah. Ia diutus kepada Bani Israil dengan kitab Injil, menyeru tauhid dan membawa banyak mukjizat. Kaumnya berencana membunuhnya, namun Allah mengangkatnya ke langit dan menyelamatkannya. Umat Islam meyakini ia akan turun kembali di akhir zaman.'
  },
  {
    nama: 'Muhammad',
    umur: '63 tahun',
    mukjizat: 'Al-Qur\'an (mukjizat terbesar dan kekal); membelah bulan; Isra Mi\'raj; air memancar dari jari-jarinya.',
    kisah: 'Muhammad adalah nabi dan rasul terakhir (khatamun nabiyyin), diutus untuk seluruh umat manusia. Ia menerima wahyu pertama di Gua Hira pada usia 40 tahun. Selama 23 tahun berdakwah, ia menghadapi penolakan, hijrah ke Madinah, membangun masyarakat Islam pertama, dan akhirnya kembali menaklukkan Mekah dengan damai. Al-Qur\'an menjadi mukjizatnya yang kekal hingga akhir zaman.'
  }
]

function normalize(nama = '') {
  return String(nama)
    .toLowerCase()
    .replace(/^nabi\s+/, '')
    .replace(/[.\-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Aliases umum biar fleksibel
const ALIASES = {
  'zul kifli': 'zulkifli',
  'dzulkifli': 'zulkifli',
  'saleh': 'shalih',
  'soleh': 'shalih',
  'salih': 'shalih',
  'khidir': null, // bukan nabi dalam urutan 25
  'ellyas': 'ilyas',
  'ellyasa': 'ilyasa',
}

/**
 * Ambil data nabi berdasarkan nama.
 * @param {string} nama - nama nabi (boleh dengan prefix "nabi ")
 * @returns {object|null} {nama, umur, mukjizat, kisah} atau null
 */
export function getKisahNabi(nama) {
  const key = normalize(nama)
  if (!key) return null
  const aliased = ALIASES[key] !== undefined ? ALIASES[key] : key
  if (!aliased) return null
  const found = NABI.find(n => normalize(n.nama) === aliased)
  return found || null
}

/** Daftar nama 25 nabi & rasul. */
export function listNabi() {
  return NABI.map(n => n.nama)
}

export default { getKisahNabi, listNabi }
