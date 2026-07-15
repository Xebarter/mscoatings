import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ScanBarcode, Trash2, Upload, X } from 'lucide-react';
import {
  addProduct,
  deleteProduct,
  getProductById,
  updateProduct,
} from '@/lib/firestore';
import { uploadProductImage, validateProductImage } from '@/lib/storage';
import { downloadProductBarcodeLabel } from '@/lib/product-barcode';
import { adminFetch } from '@/lib/admin-api';
import { enqueueImageUpload } from '@/lib/offline/flush-queue';
import { useOnline } from '@/hooks/useOnline';
import { PageLoader } from '@/components/LoadingSpinner';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600';

export default function ProductEditPage() {
  const { id: productId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const online = useOnline();
  const isNewProduct = productId === 'new' || !productId;
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
    barcode: '',
    sku: '',
    brand: '',
    costPrice: 0,
    reorderLevel: 5,
  });

  useEffect(() => {
    if (isNewProduct || !productId) return;
    void loadProduct(productId);
  }, [isNewProduct, productId]);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const loadProduct = async (id: string) => {
    try {
      const product = await getProductById(id);
      if (!product) {
        toast.error('Product not found');
        navigate('/products');
        return;
      }
      setFormData({
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        stock: product.stock,
        image: product.image,
        barcode: product.barcode ?? '',
        sku: product.sku ?? '',
        brand: product.brand ?? '',
        costPrice: product.costPrice ?? 0,
        reorderLevel: product.reorderLevel ?? 5,
      });
      setImagePreview(product.image);
    } catch {
      toast.error('Failed to load product');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'price' ||
        name === 'stock' ||
        name === 'costPrice' ||
        name === 'reorderLevel'
          ? parseFloat(value) || 0
          : value,
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startImageUpload = async (file: File) => {
    if (!online) {
      toast('Image kept locally — will upload when you reconnect', {
        icon: '📡',
        duration: 3500,
      });
      return;
    }
    setIsUploadingImage(true);
    setUploadProgress(0);
    setUploadedImageUrl('');
    try {
      const imageUrl = await uploadProductImage(file, setUploadProgress);
      setUploadedImageUrl(imageUrl);
      setFormData((prev) => ({ ...prev, image: imageUrl }));
      toast.success('Image uploaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
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

  const handleGenerateBarcode = async () => {
    if (!online) {
      const local = `MSC${Date.now().toString().slice(-10)}${Math.floor(10 + Math.random() * 89)}`;
      setFormData((prev) => ({ ...prev, barcode: local }));
      toast.success('Offline barcode generated');
      return;
    }
    try {
      const res = await adminFetch('/api/products/barcode', { method: 'GET' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Failed to generate barcode'
        );
      }
      setFormData((prev) => ({ ...prev, barcode: String(data.barcode ?? '') }));
      toast.success('Barcode generated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Barcode generation failed');
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

    setIsSaving(true);
    try {
      let imageUrl = uploadedImageUrl || formData.image.trim();
      let offlineImageBlob: Blob | null = null;
      let offlineImageType = 'image/jpeg';

      if (imageFile && !uploadedImageUrl) {
        if (online) {
          imageUrl = await uploadProductImage(imageFile);
        } else {
          // Keep binary blob in IndexedDB (not a huge data URL on the product doc).
          offlineImageBlob = imageFile;
          offlineImageType = imageFile.type || 'image/jpeg';
          imageUrl = `offline-pending://${Date.now()}`;
        }
      }

      let barcode = formData.barcode.trim();

      if (isNewProduct && !barcode) {
        if (online) {
          const barcodeResponse = await adminFetch('/api/products/barcode', {
            method: 'GET',
          });
          const barcodeData = await barcodeResponse.json().catch(() => ({}));
          if (!barcodeResponse.ok) {
            throw new Error(
              typeof barcodeData.error === 'string'
                ? barcodeData.error
                : 'Failed to generate barcode'
            );
          }
          barcode = String(barcodeData.barcode ?? '');
        } else {
          barcode = `MSC${Date.now().toString().slice(-10)}${Math.floor(10 + Math.random() * 89)}`;
        }
      }

      const productPayload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: formData.price,
        category: formData.category.trim() || 'Uncategorized',
        stock: formData.stock,
        image: imageUrl,
        ...(barcode ? { barcode } : {}),
        ...(formData.sku.trim() ? { sku: formData.sku.trim() } : {}),
        ...(formData.brand.trim() ? { brand: formData.brand.trim() } : {}),
        costPrice: formData.costPrice,
        reorderLevel: formData.reorderLevel,
      };

      let savedId = productId;
      if (isNewProduct) {
        savedId = await addProduct(productPayload);
        toast.success(
          online ? 'Product created' : 'Product saved offline — will sync when online'
        );
      } else if (productId) {
        await updateProduct(productId, productPayload);
        toast.success(
          online ? 'Product updated' : 'Product updated offline — will sync when online'
        );
      }

      if (offlineImageBlob && savedId) {
        await enqueueImageUpload({
          id: `product-image-${savedId}`,
          productId: savedId,
          contentType: offlineImageType,
          blob: offlineImageBlob,
        });
      }

      navigate('/products');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!productId || isNewProduct) return;
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteProduct(productId);
      toast.success('Product deleted');
      navigate('/products');
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const handleDownloadBarcode = async () => {
    if (!formData.barcode.trim()) {
      toast.error('Set a barcode first');
      return;
    }
    try {
      await downloadProductBarcodeLabel({
        id: productId ?? 'new',
        name: formData.name || 'Product',
        price: formData.price,
        barcode: formData.barcode,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed');
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/products"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft size={18} />
          Back to Products
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {isNewProduct ? 'Add Product' : 'Edit Product'}
        </h1>
        <p className="mt-1 text-slate-500">
          {isNewProduct
            ? 'Create a new catalog item'
            : 'Update details, pricing, and inventory'}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Product Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Category
            </label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Price (UGX)
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleInputChange}
              className={inputClass}
              min={0}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Cost Price (UGX)
            </label>
            <input
              type="number"
              name="costPrice"
              value={formData.costPrice}
              onChange={handleInputChange}
              className={inputClass}
              min={0}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Stock
            </label>
            <input
              type="number"
              name="stock"
              value={formData.stock}
              onChange={handleInputChange}
              className={inputClass}
              min={0}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Reorder Level
            </label>
            <input
              type="number"
              name="reorderLevel"
              value={formData.reorderLevel}
              onChange={handleInputChange}
              className={inputClass}
              min={0}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              SKU
            </label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={handleInputChange}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Brand
            </label>
            <input
              type="text"
              name="brand"
              value={formData.brand}
              onChange={handleInputChange}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Barcode
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                name="barcode"
                value={formData.barcode}
                onChange={handleInputChange}
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => void handleGenerateBarcode()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ScanBarcode size={16} />
                Generate
              </button>
              {formData.barcode && (
                <button
                  type="button"
                  onClick={() => void handleDownloadBarcode()}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
                >
                  Download label
                </button>
              )}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Image URL
            </label>
            <input
              type="url"
              name="image"
              value={formData.image}
              onChange={(e) => {
                const { value } = e.target;
                if (value.trim() && imageFile) clearSelectedImage();
                setUploadedImageUrl('');
                setFormData((prev) => ({ ...prev, image: value }));
                setImagePreview(value.trim() || '');
              }}
              className={inputClass}
              placeholder="https://"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Or upload image
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Upload size={16} />
                Choose file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) selectImageFile(file);
                }}
              />
              {imageFile && (
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
                >
                  <X size={14} />
                  Clear
                </button>
              )}
              {isUploadingImage && (
                <span className="text-sm text-slate-500">
                  Uploading… {uploadProgress}%
                </span>
              )}
            </div>
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="mt-3 h-32 w-32 rounded-lg object-cover"
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-6">
          <button
            type="submit"
            disabled={isSaving || isUploadingImage}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          {!isNewProduct && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
