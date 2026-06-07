const { db } = require('../firebase/firebaseAdmin');

const collectionName = 'categories';
const productCollection = 'products';

const defaultCategories = [
  { name: 'Shimmer Leggings', section: 'Womens' },
  { name: 'Shimmer Duppatta', section: 'Womens' },
  { name: 'Normal Leggings', section: 'Womens' },
  { name: 'Boys', section: 'Kids' },
  { name: 'Girls', section: 'Kids' },
  { name: 'Dresses', section: 'Womens' },
  { name: 'Tops', section: 'Womens' },
  { name: 'Accessories', section: 'Accessories' },
  { name: 'Sale', section: '' }
];

exports.getAllCategories = async (req, res) => {
  try {
    let snapshot = await db.collection(collectionName).orderBy('name').get();

    // If categories are empty, seed the default categories with sections
    if (snapshot.empty) {
      console.log('Categories collection is empty. Auto-seeding default categories...');
      const batch = db.batch();
      for (const cat of defaultCategories) {
        const docRef = db.collection(collectionName).doc();
        batch.set(docRef, {
          name: cat.name,
          section: cat.section,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      await batch.commit();
      
      // Re-fetch after seeding
      snapshot = await db.collection(collectionName).orderBy('name').get();
    }

    const categories = [];
    const updateBatch = db.batch();
    let hasUpdates = false;

    snapshot.forEach(doc => {
      const data = doc.data();
      let section = data.section;
      let needsUpdate = false;

      if (data.section === undefined) {
        // Auto-migrate old documents to include section property
        const def = defaultCategories.find(c => c.name.toLowerCase() === data.name.toLowerCase());
        section = def ? def.section : '';
        needsUpdate = true;
      } else if (data.name.toLowerCase() === 'accessories' && data.section === '') {
        // Upgrade Accessories category specifically to have Accessories section
        section = 'Accessories';
        needsUpdate = true;
      }

      if (needsUpdate) {
        updateBatch.update(doc.ref, { section });
        categories.push({ id: doc.id, ...data, section });
        hasUpdates = true;
      } else {
        categories.push({ id: doc.id, ...data });
      }
    });

    if (hasUpdates) {
      await updateBatch.commit();
      console.log('Migrated existing category documents to include dynamic sections');
    }
    
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, section } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const trimmedName = name.trim();
    const cleanSection = (section || '').trim();

    // Check if category already exists
    const existingSnapshot = await db.collection(collectionName)
      .where('name', '==', trimmedName)
      .limit(1)
      .get();
    
    if (!existingSnapshot.empty) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const newCategory = {
      name: trimmedName,
      section: cleanSection,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection(collectionName).add(newCategory);
    res.status(201).json({ id: docRef.id, ...newCategory });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, section } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const trimmedName = name.trim();
    const cleanSection = (section !== undefined) ? section.trim() : null;

    // Fetch the category to get the old name
    const categoryDoc = await db.collection(collectionName).doc(id).get();
    if (!categoryDoc.exists) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const oldName = categoryDoc.data().name;

    const updatePayload = {
      name: trimmedName,
      updatedAt: new Date()
    };

    if (cleanSection !== null) {
      updatePayload.section = cleanSection;
    }

    // Check if renaming to another existing category name
    if (oldName !== trimmedName) {
      const existingSnapshot = await db.collection(collectionName)
        .where('name', '==', trimmedName)
        .limit(1)
        .get();
      
      if (!existingSnapshot.empty) {
        return res.status(400).json({ error: 'A category with this name already exists' });
      }
    }

    await db.collection(collectionName).doc(id).update(updatePayload);

    // Update all products with the old category name if it changed
    if (oldName !== trimmedName) {
      const productsSnapshot = await db.collection(productCollection)
        .where('category', '==', oldName)
        .get();

      if (!productsSnapshot.empty) {
        const batch = db.batch();
        productsSnapshot.forEach(doc => {
          batch.update(doc.ref, { category: trimmedName });
        });
        await batch.commit();
        console.log(`Updated category for ${productsSnapshot.size} products from "${oldName}" to "${trimmedName}"`);
      }
    }

    res.status(200).json({ message: 'Category updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the category to get the name
    const categoryDoc = await db.collection(collectionName).doc(id).get();
    if (!categoryDoc.exists) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const catName = categoryDoc.data().name;

    // Delete the category document
    await db.collection(collectionName).doc(id).delete();

    // Reset the category of products that belong to this category to an empty string
    const productsSnapshot = await db.collection(productCollection)
      .where('category', '==', catName)
      .get();

    if (!productsSnapshot.empty) {
      const batch = db.batch();
      productsSnapshot.forEach(doc => {
        batch.update(doc.ref, { category: '' });
      });
      await batch.commit();
      console.log(`Cleared category for ${productsSnapshot.size} products that were in "${catName}"`);
    }

    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
