import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Banknote,
  Boxes,
  ImageIcon,
  Info,
  Package,
  ScanBarcode,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
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

const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';
const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700';
const hintClass = 'mt-1 text-xs text-slate-500';

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Package;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

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
    fieldPickPrice: 0,
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
        fieldPickPrice: product.fieldPickPrice ?? product.price,
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
    setFormData((prev) => {
      if (
        name === 'price' ||
        name === 'stock' ||
        name === 'costPrice' ||
        name === 'fieldPickPrice' ||
        name === 'reorderLevel'
      ) {
        const numericValue = parseFloat(value) || 0;
        if (name === 'price') {
          const shouldSyncFieldPick =
            prev.fieldPickPrice === prev.price || prev.fieldPickPrice === 0;
          return {
            ...prev,
            price: numericValue,
            ...(shouldSyncFieldPick ? { fieldPickPrice: numericValue } : {}),
          };
        }
        return { ...prev, [name]: numericValue };
      }
      return { ...prev, [name]: value };
    });
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
        fieldPickPrice: formData.fieldPickPrice || formData.price,
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

  const margin =
    formData.price > 0 && formData.costPrice >= 0
      ? formData.price - formData.costPrice
      : null;
  const marginPct =
    margin !== null && formData.price > 0
      ? ((margin / formData.price) * 100).toFixed(0)
      : null;
  const fieldPickMatchesPrice =
    formData.fieldPickPrice === formData.price || formData.fieldPickPrice === 0;

  return (
    <div className="space-y-5 pb-8">
      <div>
        <Link
          to="/products"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft size={18} />
          Back to Products
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {isNewProduct ? 'Add Product' : 'Edit Product'}
            </h1>
            <p className="mt-1 text-slate-500">
              {isNewProduct
                ? 'Create a new catalog item'
                : 'Update details, pricing, and inventory'}
            </p>
          </div>
          {!online && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
              Offline — saves locally
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <FormSection
              icon={Package}
              title="Basics"
              description="Name and how this product appears in the catalog."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={fieldClass}
                    required
                    placeholder="Premium Clear Coat"
                  />
                </div>
                <div>
                  <label className={labelClass}>Category</label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={fieldClass}
                    placeholder="Paint Types"
                  />
                </div>
                <div>
                  <label className={labelClass}>Brand</label>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleInputChange}
                    className={fieldClass}
                    placeholder="e.g. Standox"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className={fieldClass}
                    placeholder="Short description for staff…"
                  />
                </div>
                <div>
                  <label className={labelClass}>SKU</label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleInputChange}
                    className={fieldClass}
                    placeholder="Internal SKU"
                  />
                </div>
                <div>
                  <label className={labelClass}>Barcode</label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      name="barcode"
                      value={formData.barcode}
                      onChange={handleInputChange}
                      className={`${fieldClass} min-w-0 flex-1 font-mono`}
                      placeholder="Auto on save if empty"
                    />
                    <button
                      type="button"
                      onClick={() => void handleGenerateBarcode()}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      <ScanBarcode size={16} />
                      Generate
                    </button>
                    {formData.barcode && (
                      <button
                        type="button"
                        onClick={() => void handleDownloadBarcode()}
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
                      >
                        Label
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection
              icon={Banknote}
              title="Pricing"
              description="Retail, field agent, and cost prices in UGX."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>
                    Selling Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price || ''}
                    onChange={handleInputChange}
                    className={fieldClass}
                    min={0}
                    placeholder="50000"
                  />
                  <p className={hintClass}>POS &amp; storefront</p>
                </div>
                <div>
                  <label className={labelClass}>Field Pick Price</label>
                  <input
                    type="number"
                    name="fieldPickPrice"
                    value={formData.fieldPickPrice || ''}
                    onChange={handleInputChange}
                    className={fieldClass}
                    min={0}
                    placeholder="50000"
                  />
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <p className={`${hintClass} mt-0`}>Field agent picks</p>
                    {!fieldPickMatchesPrice && formData.price > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            fieldPickPrice: prev.price,
                          }))
                        }
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Match selling price
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Cost Price</label>
                  <input
                    type="number"
                    name="costPrice"
                    value={formData.costPrice || ''}
                    onChange={handleInputChange}
                    className={fieldClass}
                    min={0}
                    placeholder="30000"
                  />
                  <p className={hintClass}>Supplier cost</p>
                </div>
              </div>
              {margin !== null && formData.price > 0 && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3.5 py-3 text-sm text-emerald-800">
                  <Info size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <p>
                    Gross margin about{' '}
                    <span className="font-semibold">
                      {margin.toLocaleString()} UGX
                    </span>
                    {marginPct !== null && (
                      <>
                        {' '}
                        <span className="text-emerald-700">({marginPct}%)</span>
                      </>
                    )}{' '}
                    per unit at selling price.
                  </p>
                </div>
              )}
            </FormSection>

            <FormSection
              icon={Boxes}
              title="Inventory"
              description="Opening stock and when to reorder."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Stock on hand</label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock || ''}
                    onChange={handleInputChange}
                    className={fieldClass}
                    min={0}
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className={labelClass}>Reorder level</label>
                  <input
                    type="number"
                    name="reorderLevel"
                    value={formData.reorderLevel || ''}
                    onChange={handleInputChange}
                    className={fieldClass}
                    min={0}
                    placeholder="5"
                  />
                  <p className={hintClass}>Alert when stock reaches this level</p>
                </div>
              </div>
            </FormSection>
          </div>

          <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
            <FormSection
              icon={ImageIcon}
              title="Product image"
              description="Required. Upload a file or paste a URL."
            >
              <div className="space-y-4">
                <div
                  className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 transition hover:border-blue-400 hover:bg-blue-50/40"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) selectImageFile(file);
                  }}
                >
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-48 rounded-lg object-contain"
                      />
                      {imageFile && (
                        <button
                          type="button"
                          onClick={clearSelectedImage}
                          className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white shadow-md hover:bg-red-700"
                          aria-label="Clear image"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <Upload className="mb-3 h-9 w-9 text-slate-400" />
                      <p className="mb-1 text-sm font-medium text-slate-700">
                        Drop image here
                      </p>
                      <p className="mb-4 text-xs text-slate-500">PNG, JPG, WebP</p>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    {imagePreview ? 'Change image' : 'Choose file'}
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
                  {isUploadingImage && (
                    <p className="mt-3 text-sm text-slate-500">
                      Uploading… {uploadProgress}%
                    </p>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-400">or URL</span>
                  </div>
                </div>

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
                  className={fieldClass}
                  placeholder="https://"
                />
              </div>
            </FormSection>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur">
          <p className="hidden text-sm text-slate-500 sm:block">
            {isNewProduct
              ? 'Barcode is generated automatically on save if empty.'
              : 'Changes sync when you are back online.'}
          </p>
          <div className="flex w-full flex-wrap gap-3 sm:w-auto">
            {!isNewProduct && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving || isUploadingImage}
              className="min-w-[140px] flex-1 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 sm:flex-none"
            >
              {isSaving
                ? 'Saving…'
                : isUploadingImage
                  ? 'Waiting for upload…'
                  : isNewProduct
                    ? 'Create product'
                    : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
