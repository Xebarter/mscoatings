'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  addProduct,
  getProducts,
  updateProduct,
  deleteProduct,
} from '@/lib/firestore';
import { uploadProductImage, validateProductImage } from '@/lib/storage';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import { ArrowLeft, Trash2, Upload, X } from 'lucide-react';
import Link from 'next/link';

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const isNewProduct = productId === 'new';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(!isNewProduct);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    category: '',
    stock: 0,
    image: '',
  });

  useEffect(() => {
    if (!isNewProduct) {
      loadProduct();
    }
  }, [isNewProduct, productId]);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const loadProduct = async () => {
    try {
      const products = await getProducts();
      const product = products.find((p) => p.id === productId);
      if (product) {
        setFormData({
          name: product.name,
          description: product.description,
          price: product.price,
          category: product.category,
          stock: product.stock,
          image: product.image,
        });
        setImagePreview(product.image);
      } else {
        toast.error('Product not found');
        router.push('/admin/dashboard');
      }
    } catch (error) {
      console.error('Error loading product:', error);
      toast.error('Failed to load product');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'price' || name === 'stock' ? parseFloat(value) || 0 : value,
    }));
  };

  const clearSelectedImage = () => {
    if (imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setUploadedImageUrl('');
    setUploadProgress(0);
    setIsUploadingImage(false);
    setImagePreview(formData.image);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startImageUpload = async (file: File) => {
    setIsUploadingImage(true);
    setUploadProgress(0);
    setUploadedImageUrl('');

    try {
      const imageUrl = await uploadProductImage(file, setUploadProgress);
      setUploadedImageUrl(imageUrl);
      setFormData((prev) => ({ ...prev, image: imageUrl }));
      toast.success('Image uploaded');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to upload image'
      );
      clearSelectedImage();
    } finally {
      setIsUploadingImage(false);
    }
  };

  const selectImageFile = (file: File) => {
    const validationError = validateProductImage(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setFormData((prev) => ({ ...prev, image: '' }));
    setUploadedImageUrl('');
    setImagePreview(URL.createObjectURL(file));
    void startImageUpload(file);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    selectImageFile(file);
  };

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    if (value.trim() && imageFile) {
      clearSelectedImage();
    }
    setUploadedImageUrl('');
    setUploadProgress(0);
    setIsUploadingImage(false);
    setFormData((prev) => ({ ...prev, image: value }));
    if (value.trim()) {
      setImagePreview(value);
    } else if (!imageFile) {
      setImagePreview('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Please enter product name');
      return;
    }
    if (formData.price <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }
    if (!imageFile && !formData.image.trim()) {
      toast.error('Please upload an image or enter an image URL');
      return;
    }
    if (imageFile && isUploadingImage) {
      toast.error('Please wait for the image upload to finish');
      return;
    }
    if (imageFile && !uploadedImageUrl && !formData.image.trim()) {
      toast.error('Image upload failed. Please try selecting the image again');
      return;
    }

    setIsSaving(true);

    try {
      const imageUrl = uploadedImageUrl || formData.image.trim();

      const productPayload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: formData.price,
        category: formData.category.trim() || 'Uncategorized',
        stock: formData.stock,
        image: imageUrl,
      };

      if (isNewProduct) {
        await addProduct(productPayload);
        toast.success('Product created successfully!');
      } else {
        await updateProduct(productId, productPayload);
        toast.success('Product updated successfully!');
      }

      router.push('/admin/dashboard?tab=products');
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to save product'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await deleteProduct(productId);
      toast.success('Product deleted successfully!');
      router.push('/admin/dashboard?tab=products');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  return (
    <AdminGuard>
      <AdminLayout
        activeSection="products"
        title={isNewProduct ? 'Add New Product' : 'Edit Product'}
        subtitle={
          isNewProduct
            ? 'Create a new item for your store catalog.'
            : 'Update product details, pricing, and inventory.'
        }
      >
        <Link
          href="/admin/dashboard?tab=products"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-600"
        >
          <ArrowLeft size={18} />
          Back to Products
        </Link>

        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Product Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Premium Clear Coat"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    placeholder="Paint Types"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Price (UGX)
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="50000"
                    step="1"
                    min="0"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Stock
                  </label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleInputChange}
                    placeholder="100"
                    min="0"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Product Image
                </label>

                <div className="space-y-4">
                  <div
                    className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 transition hover:border-blue-400 hover:bg-blue-50/30"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (!file) return;
                      selectImageFile(file);
                    }}
                  >
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Product preview"
                          className="max-h-48 rounded-lg object-contain"
                        />
                        {imageFile && (
                          <button
                            type="button"
                            onClick={clearSelectedImage}
                            className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white shadow-md transition hover:bg-red-700"
                            aria-label="Remove selected image"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <Upload className="mb-3 h-10 w-10 text-slate-400" />
                        <p className="mb-1 text-sm font-medium text-slate-700">
                          Drag and drop an image here
                        </p>
                        <p className="mb-4 text-xs text-slate-500">
                          PNG, JPG, WebP up to 5MB
                        </p>
                      </>
                    )}

                    <label className={`cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 ${isUploadingImage ? 'pointer-events-none opacity-70' : ''}`}>
                      {imagePreview ? 'Change Image' : 'Choose File'}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        disabled={isUploadingImage}
                        className="hidden"
                      />
                    </label>

                    {isUploadingImage && (
                      <div className="mt-4 w-full max-w-xs">
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                          <span>Uploading image...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {uploadedImageUrl && !isUploadingImage && imageFile && (
                      <p className="mt-3 text-xs font-medium text-emerald-600">
                        Image ready — save the product when you are done
                      </p>
                    )}
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-slate-500">or use a URL</span>
                    </div>
                  </div>

                  <input
                    type="url"
                    name="image"
                    value={formData.image}
                    onChange={handleImageUrlChange}
                    placeholder="https://example.com/image.jpg"
                    disabled={!!imageFile}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter product description..."
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div className="flex gap-4 pt-6 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSaving || isUploadingImage}
                  className="flex-1 rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving
                    ? 'Saving...'
                    : isUploadingImage
                      ? 'Waiting for upload...'
                      : 'Save Product'}
                </button>

                {!isNewProduct && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700"
                  >
                    <Trash2 size={20} />
                    Delete
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
