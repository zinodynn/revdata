import { FileOutlined, FolderOpenOutlined, FolderOutlined, PictureOutlined } from '@ant-design/icons'
import { Button, message, Modal, Progress, Space, Tag, Tree, Typography } from 'antd'
import type { DataNode } from 'antd/es/tree'
import React, { useState } from 'react'
import { datasetsApi } from '../services/api'

const { Text } = Typography

interface DirectoryUploadModalProps {
  visible: boolean
  onCancel: () => void
  onUploadSuccess: () => void
  currentFolderId?: number | null
}

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
  file?: File
  isDataFile?: boolean
  isAsset?: boolean
}

const DirectoryUploadModal: React.FC<DirectoryUploadModalProps> = ({
  visible,
  onCancel,
  onUploadSuccess,
  currentFolderId,
}) => {
  const [fileTree, setFileTree] = useState<FileNode | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [stats, setStats] = useState({ dataFiles: 0, assets: 0, total: 0 })

  // 判断是否为数据文件
  const isDataFile = (filename: string): boolean => {
    const dataExts = ['.jsonl', '.json', '.csv', '.tsv', '.parquet']
    return dataExts.some(ext => filename.toLowerCase().endsWith(ext))
  }

  // 判断是否为资源文件（图片）
  const isAssetFile = (filename: string): boolean => {
    const assetExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
    return assetExts.some(ext => filename.toLowerCase().endsWith(ext))
  }

  // 判断是否应该保留文件
  const shouldKeepFile = (filename: string): boolean => {
    if (filename.startsWith('.') || filename.startsWith('__')) return false
    return isDataFile(filename) || isAssetFile(filename)
  }

  // 处理目录选择
  const handleDirectorySelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    // 构建文件树
    const root: FileNode = {
      name: '根目录',
      path: '',
      isDirectory: true,
      children: [],
    }

    const pathMap = new Map<string, FileNode>()
    pathMap.set('', root)

    let dataCount = 0
    let assetCount = 0
    let totalCount = 0

    files.forEach((file) => {
      const relativePath = (file as any).webkitRelativePath || file.name
      const parts = relativePath.split('/')
      
      // 跳过不需要的文件
      if (!shouldKeepFile(parts[parts.length - 1])) return

      totalCount++
      const isData = isDataFile(parts[parts.length - 1])
      const isAsset = isAssetFile(parts[parts.length - 1])
      if (isData) dataCount++
      if (isAsset) assetCount++

      let currentPath = ''
      let currentNode = root

      // 创建目录结构
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]
        const newPath = currentPath ? `${currentPath}/${part}` : part

        if (!pathMap.has(newPath)) {
          const dirNode: FileNode = {
            name: part,
            path: newPath,
            isDirectory: true,
            children: [],
          }
          pathMap.set(newPath, dirNode)
          currentNode.children!.push(dirNode)
        }

        currentNode = pathMap.get(newPath)!
        currentPath = newPath
      }

      // 添加文件节点
      const fileName = parts[parts.length - 1]
      const filePath = relativePath
      const fileNode: FileNode = {
        name: fileName,
        path: filePath,
        isDirectory: false,
        file: file,
        isDataFile: isData,
        isAsset: isAsset,
      }
      currentNode.children!.push(fileNode)
    })

    setFileTree(root)
    setStats({ dataFiles: dataCount, assets: assetCount, total: totalCount })
    
    console.log('[DirectoryUploadModal] File tree:', {
      total: totalCount,
      dataFiles: dataCount,
      assets: assetCount,
      structure: root,
    })
    
    // 默认全选所有目录和文件
    const allKeys: string[] = []
    const collectKeys = (node: FileNode) => {
      if (node.path) allKeys.push(node.path)
      node.children?.forEach(collectKeys)
    }
    root.children?.forEach(collectKeys)
    
    console.log('[DirectoryUploadModal] Default selected keys:', allKeys)
    setSelectedKeys(allKeys)

    message.success(`已识别 ${dataCount} 个数据文件，${assetCount} 个资源文件`)
  }

  // 转换为 Ant Design Tree 数据格式
  const convertToTreeData = (node: FileNode): DataNode => {
    const key = node.path || 'root'
    
    let icon = <FolderOutlined />
    let title = node.name
    
    if (!node.isDirectory) {
      if (node.isDataFile) {
        icon = <FileOutlined style={{ color: '#52c41a' }} />
        title = `${node.name} (数据文件)`
      } else if (node.isAsset) {
        icon = <PictureOutlined style={{ color: '#1890ff' }} />
        title = `${node.name} (图片)`
      } else {
        icon = <FileOutlined />
      }
    }

    return {
      key,
      title: (
        <Space>
          {icon}
          <span>{title}</span>
        </Space>
      ),
      children: node.children?.map(convertToTreeData),
      checkable: node.path !== '', // 根目录不可选
      selectable: false,
    }
  }

  // 收集选中的文件
  const collectSelectedFiles = (): { files: File[], pathMapping: Record<string, string> } => {
    const files: File[] = []
    const pathMapping: Record<string, string> = {}
    const selectedSet = new Set(selectedKeys)

    console.log('[collectSelectedFiles] selectedKeys:', selectedKeys)
    console.log('[collectSelectedFiles] selectedSet:', Array.from(selectedSet))

    // 检查路径是否被选中（直接或通过父目录）
    const isPathSelected = (path: string): boolean => {
      if (selectedSet.has(path)) return true
      
      // 检查所有父目录
      const parts = path.split('/')
      for (let i = parts.length - 1; i > 0; i--) {
        const parentPath = parts.slice(0, i).join('/')
        if (selectedSet.has(parentPath)) return true
      }
      return false
    }

    // 递归收集所有选中的文件
    const collect = (node: FileNode, depth = 0) => {
      const indent = '  '.repeat(depth)
      
      if (!node.isDirectory && node.file) {
        // 这是一个文件节点，检查是否应该包含
        const selected = isPathSelected(node.path)
        console.log(`${indent}[collect] File: ${node.path}, selected=${selected}, name=${node.file.name}`)
        if (selected) {
          files.push(node.file)
          // ⭐️ key 是完整相对路径（与 file.webkitRelativePath 匹配）, value 也是完整路径
          pathMapping[node.path] = node.path
          console.log(`${indent}  → Added: pathMapping['${node.path}'] = '${node.path}'`)
        }
      } else if (node.isDirectory) {
        console.log(`${indent}[collect] Dir: ${node.path}`)
      }
      
      // 继续处理子节点
      if (node.children) {
        node.children.forEach(child => collect(child, depth + 1))
      }
    }

    // 从根目录开始递归
    if (fileTree?.children) {
      fileTree.children.forEach(child => collect(child))
    }

    console.log('[collectSelectedFiles] Result:', { files: files.length, pathMapping: Object.keys(pathMapping) })
    return { files, pathMapping }
  }

  // 处理上传
  const handleUpload = async () => {
    if (!fileTree) {
      message.error('请先选择目录')
      return
    }

    const { files, pathMapping } = collectSelectedFiles()
    
    console.log('\n' + '='.repeat(60))
    console.log('[DirectoryUploadModal] UPLOAD START')
    console.log('  Collected files:', files.length)
    console.log('  File names:', files.map(f => f.name))
    console.log('  Path mapping:', pathMapping)
    console.log('  Path mapping keys:', Object.keys(pathMapping))
    console.log('  Path mapping values:', Object.values(pathMapping))
    console.log('='.repeat(60) + '\n')
    
    if (files.length === 0) {
      message.error('请至少选择一个文件或目录')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const res = await datasetsApi.uploadDirectory(
        files,
        pathMapping,
        currentFolderId || undefined,
        (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total ?? 1)
          )
          setUploadProgress(percentCompleted)
        }
      )

      console.log('[DirectoryUploadModal] Upload response:', res.data)
      message.success(res.data.message || '上传成功')
      handleClose()
      onUploadSuccess()
    } catch (error: any) {
      console.error('[DirectoryUploadModal] Upload error:', error)
      message.error(error.response?.data?.detail || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setFileTree(null)
    setSelectedKeys([])
    setUploadProgress(0)
    setStats({ dataFiles: 0, assets: 0, total: 0 })
    onCancel()
  }

  return (
    <Modal
      title="上传目录"
      open={visible}
      onCancel={handleClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={uploading}>
          取消
        </Button>,
        <Button
          key="upload"
          type="primary"
          onClick={handleUpload}
          loading={uploading}
          disabled={!fileTree}
        >
          {uploading ? '上传中...' : '开始上传'}
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 选择目录按钮 */}
        {!fileTree && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <input
              type="file"
              id="directory-input"
              style={{ display: 'none' }}
              // @ts-ignore
              webkitdirectory="true"
              directory="true"
              multiple
              onChange={handleDirectorySelect}
            />
            <Button
              type="primary"
              size="large"
              icon={<FolderOpenOutlined />}
              onClick={() => document.getElementById('directory-input')?.click()}
            >
              选择目录
            </Button>
            <div style={{ marginTop: 16, color: '#999' }}>
              <Text type="secondary">
                支持选择包含多层子目录和数据文件的目录
                <br />
                数据文件：.jsonl, .json, .csv, .tsv
                <br />
                资源文件（保留）：图片格式（.jpg, .png, .gif 等）
              </Text>
            </div>
          </div>
        )}

        {/* 文件树预览 */}
        {fileTree && !uploading && (
          <>
            <div>
              <Text strong>已识别文件：</Text>
              <Space style={{ marginLeft: 16 }}>
                <Tag color="green">{stats.dataFiles} 个数据文件</Tag>
                <Tag color="blue">{stats.assets} 个图片</Tag>
                <Tag>{stats.total} 个文件</Tag>
              </Space>
            </div>

            <div>
              <Text type="secondary">请选择要上传的目录或文件：</Text>
              <Tree
                checkable
                checkedKeys={selectedKeys}
                onCheck={(checked) => {
                  setSelectedKeys(checked as string[])
                }}
                treeData={fileTree.children?.map(convertToTreeData) || []}
                defaultExpandAll
                style={{ marginTop: 8, maxHeight: 400, overflow: 'auto' }}
              />
            </div>

            <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <Text type="secondary">
                💡 提示：根目录下的文件将不单独显示上传情况，而是作为数据集的一部分
              </Text>
            </div>
          </>
        )}

        {/* 上传进度 */}
        {uploading && (
          <div>
            <Text strong>上传进度：</Text>
            <Progress percent={uploadProgress} status="active" />
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              正在上传文件并创建数据集，请稍候...
            </Text>
          </div>
        )}
      </Space>
    </Modal>
  )
}

export default DirectoryUploadModal
