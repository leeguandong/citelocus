import { matchesReference } from '../app/article-reference.mjs';

const tgrs = 'IEEE Transactions on Geoscience and Remote Sensing';
// DOI metadata from Springer, IEEE and Elsevier. Tags are still matched against the enabled catalogs.
const articles = [
  {
    doi: '10.1007/s00521-024-10165-7',
    title: 'Advancing horizons in remote sensing: a comprehensive survey of deep learning models and applications in image classification and beyond',
    author: { given: 'Sidike', family: 'Paheding' }, years: [2024],
    venue: 'Neural Computing and Applications', issns: ['0941-0643', '1433-3058'],
  },
  {
    doi: '10.1109/tpami.2025.3557581', ieee: '10949864',
    title: 'HyperSIGMA: Hyperspectral Intelligence Comprehension Foundation Model',
    author: { given: 'Di', family: 'Wang' }, years: [2025],
    venue: 'IEEE Transactions on Pattern Analysis and Machine Intelligence', issns: ['1939-3539'],
  },
  {
    doi: '10.1109/tip.2023.3287738', ieee: '10167502',
    title: 'Hyperspectral Image Classification With Multi-Attention Transformer and Adaptive Superpixel Segmentation-Based Active Learning',
    author: { given: 'Chunhui', family: 'Zhao' }, years: [2023],
    venue: 'IEEE Transactions on Image Processing', issns: ['1941-0042'],
  },
  {
    doi: '10.1109/tgrs.2023.3307609', ieee: '10226219',
    title: 'An Offset Graph U-Net for Hyperspectral Image Classification',
    author: { given: 'Rong', family: 'Chen' }, years: [2023],
    venue: tgrs, issns: ['1558-0644'],
  },
  {
    doi: '10.1109/tgrs.2023.3305499', ieee: '10221754',
    title: 'Adjacent-Level Feature Cross-Fusion With 3-D CNN for Remote Sensing Image Change Detection',
    author: { given: 'Yuanxin', family: 'Ye' }, years: [2023],
    venue: tgrs, issns: ['1558-0644'],
  },
  {
    doi: '10.1016/j.dt.2022.02.007', pii: 'S2214914722000319',
    title: 'Deep hybrid: Multi-graph neural network collaboration for hyperspectral image classification',
    author: { given: 'Ding', family: 'Yao' }, years: [2023],
    venue: 'Defence Technology', issns: ['2214-9147'],
  },
  {
    doi: '10.1109/tnnls.2022.3171572', ieee: '9772757',
    title: 'Hyperspectral and SAR Image Classification via Multiscale Interactive Fusion Network',
    author: { given: 'Junjie', family: 'Wang' }, years: [2022, 2023],
    venue: 'IEEE Transactions on Neural Networks and Learning Systems', issns: ['2162-2388'],
  },
  {
    doi: '10.1109/tgrs.2021.3100578', ieee: '9506991',
    title: 'Semi-Supervised Locality Preserving Dense Graph Neural Network With ARMA Filters and Context-Aware Learning for Hyperspectral Image Classification',
    author: { given: 'Yao', family: 'Ding' }, years: [2021, 2022],
    venue: tgrs, issns: ['1558-0644'],
  },
];

export function verifiedArticle(kind, id) {
  const article = kind === 'title'
    ? articles.find(({ title, author, years }) => matchesReference(id, [title], author, years))
    : articles.find((item) => item[kind] === id);
  if (!article) return null;
  return { venue: article.venue, type: 'journal', issns: article.issns };
}
