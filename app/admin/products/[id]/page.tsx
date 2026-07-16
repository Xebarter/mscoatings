'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  addProduct,
  getProducts,
  updateProduct,
  deleteProduct,
} from '@/lib/firestore';
import { uploadProductImage, validateProductImage } from '@/lib/storage';
import { requestCatalogRevalidation } from '@/lib/request-catalog-revalidation';
import { adminFetch } from '@/lib/admin-api';
import { downloadProductBarcodeLabel } from '@/lib/product-barcode';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import {
  ArrowLeft,
  Banknote,
  Boxes,
  ImageIcon,
  Info,
  Package,
  PaintBucket,
  ScanBarcode,
  Store,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import Link from 'next/link';

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
    barcode: '',
    sku: '',
    brand: '',
    paintType: '',
    colourCode: '',
    sizeVolume: '',
    packagingUnit: '',
    costPrice: 0,
    fieldPickPrice: 0,
    reorderLevel: 5,
    msProduct: true,
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
          barcode: product.barcode ?? '',
          sku: product.sku ?? '',
          brand: product.brand ?? '',
          paintType: product.paintType ?? '',
          colourCode: product.colourCode ?? '',
          sizeVolume: product.sizeVolume ?? '',
          packagingUnit: product.packagingUnit ?? '',
          costPrice: product.costPrice ?? 0,
          fieldPickPrice: product.fieldPickPrice ?? product.price,
          reorderLevel: product.reorderLevel ?? 5,
          msProduct: product.msProduct !== false,
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

      let barcode = formData.barcode.trim();
      if (isNewProduct && !barcode) {
        const barcodeResponse = await adminFetch('/api/products/barcode');
        const barcodeData = await barcodeResponse.json();
        if (!barcodeResponse.ok) {
          throw new Error(barcodeData.error ?? 'Failed to generate barcode');
        }
        barcode = barcodeData.barcode;
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
        ...(formData.paintType.trim() ? { paintType: formData.paintType.trim() } : {}),
        ...(formData.colourCode.trim() ? { colourCode: formData.colourCode.trim() } : {}),
        ...(formData.sizeVolume.trim() ? { sizeVolume: formData.sizeVolume.trim() } : {}),
        ...(formData.packagingUnit.trim()
          ? { packagingUnit: formData.packagingUnit.trim() }
          : {}),
        costPrice: formData.costPrice,
        fieldPickPrice: formData.fieldPickPrice || formData.price,
        reorderLevel: formData.reorderLevel,
        msProduct: formData.msProduct,
      };

      if (isNewProduct) {
        const newProductId = await addProduct(productPayload);
        await requestCatalogRevalidation(newProductId);
        toast.success('Product created successfully!');
      } else {
        await updateProduct(productId, productPayload);
        await requestCatalogRevalidation(productId);
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
      await requestCatalogRevalidation(productId);
      toast.success('Product deleted successfully!');
      router.push('/admin/dashboard?tab=products');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

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
        <div className="pb-28">
          <Link
            href="/admin/dashboard?tab=products"
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-600"
          >
            <ArrowLeft size={18} />
            Back to Products
          </Link>

          {isLoading ? (
            <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-24 shadow-sm">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                    <Store size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold tracking-tight text-slate-900">
                      MS product
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      When off, this product stays in inventory and POS but is hidden from
                      the shop and home page.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.msProduct}
                  aria-label="MS product"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, msProduct: !prev.msProduct }))
                  }
                  className={`relative h-8 w-14 shrink-0 rounded-full transition ${
                    formData.msProduct ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition ${
                      formData.msProduct ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-5">
                  <FormSection
                    icon={Package}
                    title="Basics"
                    description="Name and how this product appears in the catalog."
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className={labelClass}>
                          Product Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Premium Clear Coat"
                          required
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Category</label>
                        <input
                          type="text"
                          name="category"
                          value={formData.category}
                          onChange={handleInputChange}
                          placeholder="Paint Types"
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Brand</label>
                        <input
                          type="text"
                          name="brand"
                          value={formData.brand}
                          onChange={handleInputChange}
                          placeholder="e.g. Standox"
                          className={fieldClass}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Description</label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          placeholder="Short description for staff and customers…"
                          rows={3}
                          className={fieldClass}
                        />
                      </div>
                    </div>
                  </FormSection>

                  <FormSection
                    icon={Banknote}
                    title="Pricing"
                    description="Retail, field agent, and cost prices in UGX."
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className={labelClass}>
                          Selling Price <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          name="price"
                          value={formData.price || ''}
                          onChange={handleInputChange}
                          placeholder="50000"
                          step="1"
                          min="0"
                          className={fieldClass}
                        />
                        <p className={hintClass}>POS &amp; storefront price</p>
                      </div>
                      <div>
                        <label className={labelClass}>Field Pick Price</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            name="fieldPickPrice"
                            value={formData.fieldPickPrice || ''}
                            onChange={handleInputChange}
                            placeholder="50000"
                            step="1"
                            min="0"
                            className={fieldClass}
                          />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <p className={`${hintClass} mt-0`}>
                            Used when field agents pick stock
                          </p>
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
                          placeholder="30000"
                          step="1"
                          min="0"
                          className={fieldClass}
                        />
                        <p className={hintClass}>What you pay suppliers</p>
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
                              (<span className="text-emerald-700">({marginPct}%)</span>
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
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>Stock on hand</label>
                        <input
                          type="number"
                          name="stock"
                          value={formData.stock || ''}
                          onChange={handleInputChange}
                          placeholder="100"
                          min="0"
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Reorder level</label>
                        <input
                          type="number"
                          name="reorderLevel"
                          value={formData.reorderLevel || ''}
                          onChange={handleInputChange}
                          placeholder="5"
                          min="0"
                          className={fieldClass}
                        />
                        <p className={hintClass}>Alert when stock reaches this level</p>
                      </div>
                    </div>
                  </FormSection>

                  <FormSection
                    icon={PaintBucket}
                    title="Product details"
                    description="Optional specs for paint and packaging."
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>Paint Type</label>
                        <input
                          type="text"
                          name="paintType"
                          value={formData.paintType}
                          onChange={handleInputChange}
                          placeholder="e.g. Basecoat, Clearcoat"
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Colour / Paint Code</label>
                        <input
                          type="text"
                          name="colourCode"
                          value={formData.colourCode}
                          onChange={handleInputChange}
                          placeholder="e.g. Toyota 040 Super White"
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Size / Volume</label>
                        <input
                          type="text"
                          name="sizeVolume"
                          value={formData.sizeVolume}
                          onChange={handleInputChange}
                          placeholder="e.g. 1L, 4L"
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Packaging Unit</label>
                        <input
                          type="text"
                          name="packagingUnit"
                          value={formData.packagingUnit}
                          onChange={handleInputChange}
                          placeholder="e.g. Tin, Can"
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>SKU</label>
                        <input
                          type="text"
                          name="sku"
                          value={formData.sku}
                          onChange={handleInputChange}
                          placeholder="Internal SKU"
                          className={fieldClass}
                        />
                      </div>
                      {!isNewProduct && formData.barcode && (
                        <div>
                          <label className={labelClass}>Barcode</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={formData.barcode}
                              readOnly
                              className={`${fieldClass} flex-1 bg-slate-50 font-mono`}
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await downloadProductBarcodeLabel({
                                    id: productId,
                                    ...formData,
                                    createdAt: {} as never,
                                  });
                                  toast.success('Barcode label downloaded');
                                } catch {
                                  toast.error('Failed to download barcode label');
                                }
                              }}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                              <ScanBarcode size={16} />
                              Print
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </FormSection>
                </div>

                <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
                  <FormSection
                    icon={ImageIcon}
                    title="Product image"
                    description="Required. Drag a file or paste a URL."
                  >
                    <div className="space-y-4">
                      <div
                        className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 transition hover:border-blue-400 hover:bg-blue-50/40"
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
                              className="max-h-52 rounded-lg object-contain"
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
                            <Upload className="mb-3 h-9 w-9 text-slate-400" />
                            <p className="mb-1 text-sm font-medium text-slate-700">
                              Drop image here
                            </p>
                            <p className="mb-4 text-xs text-slate-500">
                              PNG, JPG, WebP up to 5MB
                            </p>
                          </>
                        )}

                        <label
                          className={`cursor-pointer rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 ${
                            isUploadingImage ? 'pointer-events-none opacity-70' : ''
                          }`}
                        >
                          {imagePreview ? 'Change image' : 'Choose file'}
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
                              <span>Uploading…</span>
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
                            Image ready — save when you finish
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
                        onChange={handleImageUrlChange}
                        placeholder="https://example.com/image.jpg"
                        disabled={!!imageFile}
                        className={`${fieldClass} disabled:bg-slate-100 disabled:text-slate-500`}
                      />
                    </div>
                  </FormSection>
                </div>
              </div>

              <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
                  <p className="hidden text-sm text-slate-500 sm:block">
                    {isNewProduct
                      ? 'Barcode is generated automatically on save if empty.'
                      : 'Changes apply to catalog, POS, and field sales.'}
                  </p>
                  <div className="flex w-full flex-wrap gap-3 sm:w-auto">
                    {!isNewProduct && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSaving || isUploadingImage}
                      className="min-w-[140px] flex-1 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 sm:flex-none"
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
              </div>
            </form>
          )}
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
