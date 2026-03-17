const { db } = require('../firebase/firebaseAdmin');

const products = [
  {
    name: 'Premium Shimmer Leggings - Midnight Black',
    category: 'Shimmer Leggings',
    basePrice: 449,
    originalPrice: 599,
    description: 'Our signature shimmer leggings are crafted from ultra-soft, high-stretch fabric that provides a second-skin fit. Featuring a premium metallic sheen that doesn\'t fade, these are perfect for both festive occasions and evening wear.',
    images: ['/images/custom/11.png', '/images/custom/12.png', '/images/custom/13.png'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: [{ name: 'Midnight Black', class: 'bg-slate-900' }],
    stock: 50,
    featured: true
  },
  {
    name: 'Floral Print Summer Dress',
    category: 'Dresses',
    basePrice: 1299,
    originalPrice: 1599,
    description: 'A beautiful, lightweight floral print dress perfect for summer outings. Features a comfortable fit and breathable fabric.',
    images: ['/images/custom/14.png', '/images/custom/15.png'],
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [{ name: 'Rose Pink', class: 'bg-rose-400' }],
    stock: 30,
    featured: true
  },
  {
    name: 'Classic White Linen Top',
    category: 'Tops',
    basePrice: 899,
    originalPrice: 1099,
    description: 'A timeless white linen top that pairs perfectly with any bottom. Clean, elegant, and comfortable.',
    images: ['/images/custom/16.png', '/images/custom/17.png'],
    sizes: ['M', 'L', 'XL'],
    colors: [{ name: 'Pure White', class: 'bg-white' }],
    stock: 25,
    featured: false
  },
  {
    name: 'Normal Cotton Leggings - Navy Blue',
    category: 'Normal Leggings',
    basePrice: 349,
    originalPrice: 499,
    description: 'Comfortable everywear cotton leggings with 5% spandex for perfect stretch. Breathable and durable.',
    images: ['/images/custom/18.png', '/images/custom/19.png'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: [{ name: 'Navy Blue', class: 'bg-blue-900' }],
    stock: 100,
    featured: false
  },
  {
    name: 'Designer Party Wear Gown',
    category: 'Dresses',
    basePrice: 2499,
    originalPrice: 3499,
    description: 'Make a statement at any party with this elegantly designed gown. Features intricate detailing and a premium finish.',
    images: ['/images/custom/20.png', '/images/custom/21.png', '/images/custom/22.png'],
    sizes: ['M', 'L', 'XL'],
    colors: [{ name: 'Royal Blue', class: 'bg-blue-700' }],
    stock: 15,
    featured: true
  }
];

const seedProducts = async () => {
  try {
    console.log('Starting product seeding...');
    const collectionRef = db.collection('products');
    
    // Clear existing (optional, but good for clean state)
    const existing = await collectionRef.get();
    const batch = db.batch();
    existing.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log('Cleared existing products.');

    for (const product of products) {
      product.createdAt = new Date();
      await collectionRef.add(product);
      console.log(`Added: ${product.name}`);
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedProducts();
