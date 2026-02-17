import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import gsap from 'gsap';

interface ManagerOptions {
  onLoad: () => void;
  onHover: (name: string | null) => void;
  onExplosionUpdate: (val: number) => void;
}

export type ExplosionMode = 'radial' | 'horizontal' | 'vertical' | 'lateral' | 'depth';

// Use intersection type to ensure we keep all Mesh properties including position, material, etc.
type ExplodableMesh = THREE.Mesh & {
  userData: {
    originalPosition: THREE.Vector3;
    originalRotation: THREE.Euler;
    originalScale: THREE.Vector3; // Store original scale to prevent distortion
    geometryCenter: THREE.Vector3; // Center of the mesh geometry in world space
    explodeVector: THREE.Vector3; // Calculated local direction vector
    explosionDistance: number;    // Calculated distance from pivot for proportional explosion
    manualOffset: THREE.Vector3;  // Added for drag and drop
    isHovered: boolean;           // State flag for hover
    originalMaterial?: THREE.Material | THREE.Material[];
  };
};

export class SceneManager {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  
  private animationId: number | null = null;
  private resizeObserver: ResizeObserver;
  
  private modelGroup: THREE.Group;
  private pivotHelper: THREE.GridHelper; // Visual indicator for pivot
  private meshes: ExplodableMesh[] = [];
  
  private currentExplosionValue: number = 0;
  private targetExplosionValue: number = 0;
  private isAutoAnimating: boolean = false;
  private explosionMode: ExplosionMode = 'radial';
  
  private modelCenter: THREE.Vector3 = new THREE.Vector3();
  private modelMinY: number = 0;
  private modelHeight: number = 0;
  private pivotOffsetY: number = 0; 
  private currentPivotPercent: number = 0;
  
  // We keep track of the currently highlighted part name to avoid redundant callbacks
  private currentHoveredName: string | null = null; 
  private highlightMaterial: THREE.MeshPhysicalMaterial;

  // Dragging state
  private isDragging: boolean = false;
  private draggedObject: ExplodableMesh | null = null;
  private dragPlane: THREE.Plane = new THREE.Plane();
  private dragOffset: THREE.Vector3 = new THREE.Vector3();
  private intersectionPoint: THREE.Vector3 = new THREE.Vector3();

  private callbacks: ManagerOptions;
  
  // Lighting references
  private keyLight: THREE.DirectionalLight | null = null;

  constructor(container: HTMLElement, callbacks: ManagerOptions) {
    this.container = container;
    this.callbacks = callbacks;
    
    // Init Basic Three.js Components
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);
    this.scene.fog = new THREE.FogExp2(0x111111, 0.02);

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(8, 6, 8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0; 
    container.appendChild(this.renderer.domElement);

    // Environment for PBR
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.8;
    pmremGenerator.dispose();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 50;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.highlightMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x00ffff,
      emissive: 0x004444,
      metalness: 0.5,
      roughness: 0.1,
      transparent: true,
      opacity: 0.8,
    });
    
    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);
    
    // Setup Pivot Helper (Visual Grid)
    this.pivotHelper = new THREE.GridHelper(10, 20, 0x00ffff, 0x004444);
    this.pivotHelper.visible = false;
    
    // Setup transparency for fade effects
    const mat = this.pivotHelper.material as THREE.Material;
    if (mat) {
      mat.transparent = true;
      mat.opacity = 0.5;
      mat.depthWrite = false;
    }
    
    this.scene.add(this.pivotHelper);

    this.setupLights();
    
    this.setupEvents();
    this.startLoop();

    // Handle Window Resize
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  private setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); 
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x333333, 0.5); 
    hemiLight.position.set(0, 20, 0);
    this.scene.add(hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.5); 
    this.keyLight.position.set(5, 10, 7);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.bias = -0.0001;
    this.keyLight.shadow.mapSize.width = 2048; 
    this.keyLight.shadow.mapSize.height = 2048;
    this.scene.add(this.keyLight);

    const fillLight = new THREE.DirectionalLight(0xffeedd, 0.5); 
    fillLight.position.set(-5, 2, 5);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x4455ff, 0.8); 
    rimLight.position.set(0, 5, -10);
    this.scene.add(rimLight);
    
    const camLight = new THREE.PointLight(0xffffff, 0.1); 
    this.camera.add(camLight);
    this.scene.add(this.camera);
    
    const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    this.scene.add(grid);
  }

  private updateLightsForModel(box: THREE.Box3) {
    if (!this.keyLight) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    const cam = this.keyLight.shadow.camera;
    cam.left = -maxDim;
    cam.right = maxDim;
    cam.top = maxDim;
    cam.bottom = -maxDim;
    cam.near = 0.1;
    cam.far = maxDim * 5;
    cam.updateProjectionMatrix();

    this.keyLight.position.set(center.x + maxDim, center.y + maxDim * 1.5, center.z + maxDim);
    this.keyLight.target.position.copy(center);
    this.keyLight.target.updateMatrixWorld();
    
    this.keyLight.shadow.bias = -0.0001 * (maxDim > 10 ? 1 : 0.1); 
  }

  public loadModel(urlOrType: string | null) {
    this.clearModel();
    this.currentExplosionValue = 0;
    this.targetExplosionValue = 0;
    this.callbacks.onExplosionUpdate(0);
    this.pivotHelper.visible = false;

    if (urlOrType && (urlOrType.startsWith('http') || urlOrType.startsWith('blob:'))) {
      const loader = new GLTFLoader();
      
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      dracoLoader.setDecoderConfig({ type: 'js' });
      loader.setDRACOLoader(dracoLoader);

      loader.load(urlOrType, (gltf) => {
        this.processModel(gltf.scene);
        this.fitCameraToObject(this.modelGroup);
        this.callbacks.onLoad();
        dracoLoader.dispose();
      }, undefined, (error) => {
        console.error('Error loading model', error);
        dracoLoader.dispose();
        this.generateProceduralCube();
        this.callbacks.onLoad();
      });
    } else if (urlOrType === 'sphere') {
      this.generateProceduralSphere();
      setTimeout(() => this.callbacks.onLoad(), 600);
    } else {
      this.generateProceduralCube();
      setTimeout(() => this.callbacks.onLoad(), 600);
    }
  }

  private clearModel() {
    this.meshes.forEach(mesh => {
       mesh.geometry.dispose();
       if (Array.isArray(mesh.material)) {
         mesh.material.forEach(m => m.dispose());
       } else {
         mesh.material.dispose();
       }
    });
    this.meshes = [];
    while (this.modelGroup.children.length > 0) {
      this.modelGroup.remove(this.modelGroup.children[0]);
    }
    this.currentHoveredName = null;
    this.callbacks.onHover(null);
  }

  public setBackgroundColor(colorStr: string) {
    const color = new THREE.Color(colorStr);
    this.scene.background = color;
    this.scene.fog = new THREE.FogExp2(color, 0.02);
  }

  public setExplosionMode(mode: ExplosionMode) {
    this.explosionMode = mode;
    this.recalculateExplosionVectors();
    this.updateMeshes();
  }

  public setPivotOffsetY(yPercent: number) {
    this.currentPivotPercent = yPercent;
    
    // Interpret input as offset from Center
    const range = Math.max(this.modelHeight, 1.0); 
    this.pivotOffsetY = yPercent * range;
    
    // Update visual helper
    if (this.meshes.length > 0) {
      this.pivotHelper.visible = true;
      this.pivotHelper.position.set(this.modelCenter.x, this.modelCenter.y + this.pivotOffsetY, this.modelCenter.z);
      
      // Auto-hide helper after interaction
      const mat = this.pivotHelper.material as THREE.Material;
      gsap.killTweensOf(mat);
      mat.opacity = 0.5;
      gsap.to(mat, { opacity: 0, delay: 1.5, duration: 1, onComplete: () => { this.pivotHelper.visible = false; }});
    }

    // Recalculate explosion vectors based on new pivot
    this.recalculateExplosionVectors();
    this.updateMeshes();
  }

  public resetPartPositions() {
    this.meshes.forEach(mesh => {
      mesh.userData.manualOffset.set(0, 0, 0);
    });
    this.updateMeshes();
  }

  private generateProceduralCube() {
    const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const material = new THREE.MeshStandardMaterial({ 
            color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
            metalness: 0.1,
            roughness: 0.2
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(x, y + 2, z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.name = `Cube-${x + 1}-${y + 1}-${z + 1}`;
          this.modelGroup.add(mesh);
        }
      }
    }
    this.processModel(this.modelGroup);
  }

  private generateProceduralSphere() {
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const radius = 2.5;
    for (let x = -3; x <= 3; x++) {
      for (let y = -3; y <= 3; y++) {
        for (let z = -3; z <= 3; z++) {
          if (x*x + y*y + z*z <= radius*radius && x*x + y*y + z*z >= (radius-1.5)*(radius-1.5)) {
             const material = new THREE.MeshStandardMaterial({
              color: new THREE.Color().setHSL(Math.random() * 0.2 + 0.5, 0.8, 0.5),
              metalness: 0.3,
              roughness: 0.1
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x * 0.6, y * 0.6 + 2, z * 0.6); 
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.name = `Voxel-${x}-${y}-${z}`;
            this.modelGroup.add(mesh);
          }
        }
      }
    }
    this.processModel(this.modelGroup);
  }

  private processModel(root: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(root);
    this.modelCenter = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    this.modelMinY = box.min.y;
    this.modelHeight = size.y;
    
    const range = Math.max(this.modelHeight, 1.0);
    this.pivotOffsetY = this.currentPivotPercent * range;
    
    // Update pivot helper scale to match model width
    const maxDim = Math.max(size.x, size.z);
    // Base size is 10. We want the grid to cover the model generously.
    const scaleFactor = Math.max((maxDim * 1.5) / 10, 0.1); 
    this.pivotHelper.scale.set(scaleFactor, 1, scaleFactor);
    
    this.updateLightsForModel(box);

    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as ExplodableMesh;
        this.meshes.push(mesh);
        
        mesh.userData.originalPosition = mesh.position.clone();
        mesh.userData.originalRotation = mesh.rotation.clone();
        mesh.userData.originalScale = mesh.scale.clone(); // CRITICAL: Save original scale
        mesh.userData.originalMaterial = mesh.material;
        mesh.userData.manualOffset = new THREE.Vector3(0, 0, 0);
        mesh.userData.isHovered = false;

        const meshBox = new THREE.Box3().setFromObject(mesh);
        const meshCenter = meshBox.getCenter(new THREE.Vector3());
        mesh.userData.geometryCenter = meshCenter;

        // Initialize empty, will be set by recalculateExplosionVectors
        mesh.userData.explodeVector = new THREE.Vector3(0, 1, 0); 
        mesh.userData.explosionDistance = 0;
        
        // Ensure material receives shadow and light correctly
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.envMapIntensity = 1.0;
            mesh.material.needsUpdate = true;
        }
      }
    });
    
    // Calculate initial vectors
    this.recalculateExplosionVectors();

    if (root.parent !== this.modelGroup) {
      this.modelGroup.add(root);
    }
  }

  private recalculateExplosionVectors() {
    const effectivePivotY = this.modelCenter.y + this.pivotOffsetY;
    const pivotPoint = new THREE.Vector3(this.modelCenter.x, effectivePivotY, this.modelCenter.z);

    this.meshes.forEach(mesh => {
       const center = mesh.userData.geometryCenter; // World Center
       let worldDir = new THREE.Vector3();
       let distance = 0;

       // Calculate World Vector and Distance based on Mode
       switch(this.explosionMode) {
          case 'radial':
            worldDir.subVectors(center, pivotPoint);
            distance = worldDir.length();
            worldDir.normalize();
            if (distance < 0.001) worldDir.set(0, 1, 0);
            break;
            
          case 'horizontal':
            // Flatten Y
            const flatCenter = new THREE.Vector3(center.x, pivotPoint.y, center.z);
            worldDir.subVectors(flatCenter, pivotPoint);
            distance = worldDir.length();
            worldDir.normalize();
            if (distance < 0.001) worldDir.set(1, 0, 0);
            break;

          case 'vertical':
            distance = center.y - pivotPoint.y;
            worldDir.set(0, 1, 0);
            break;

          case 'lateral':
             distance = center.x - pivotPoint.x;
             worldDir.set(1, 0, 0);
             break;
             
          case 'depth':
             distance = center.z - pivotPoint.z;
             worldDir.set(0, 0, 1);
             break;
       }

       // Transform to Local Space (compensate for parent rotation)
       const localExplodeDir = worldDir.clone();

       if (mesh.parent) {
         const parentQuat = new THREE.Quaternion();
         mesh.parent.getWorldQuaternion(parentQuat);
         const invParentQuat = parentQuat.invert();
         localExplodeDir.applyQuaternion(invParentQuat);
       }

       mesh.userData.explodeVector.copy(localExplodeDir);
       mesh.userData.explosionDistance = distance;
    });
  }

  private fitCameraToObject(object: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));

    cameraZ *= 2.5; 
    
    gsap.to(this.camera.position, {
        x: center.x + cameraZ * 0.5,
        y: center.y + cameraZ * 0.5,
        z: center.z + cameraZ,
        duration: 1.5,
        ease: "power2.inOut",
        onUpdate: () => this.controls.update()
    });
    
    gsap.to(this.controls.target, {
        x: center.x,
        y: center.y,
        z: center.z,
        duration: 1.5,
        ease: "power2.inOut"
    });
  }

  private setupEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('mousemove', (e) => {
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      this.handleDragMove();
    });

    dom.addEventListener('mousedown', () => {
       this.handleDragStart();
    });

    dom.addEventListener('mouseup', () => {
       this.handleDragEnd();
    });

    dom.addEventListener('mouseleave', () => {
        this.handleDragEnd();
        // Clear all hover states
        this.meshes.forEach(m => { m.userData.isHovered = false; });
        this.currentHoveredName = null;
        this.callbacks.onHover(null);
    });
  }

  private handleDragStart() {
    const hoveredMesh = this.meshes.find(m => m.userData.isHovered);
    if (hoveredMesh) {
      this.isDragging = true;
      this.draggedObject = hoveredMesh;
      this.controls.enabled = false;
      this.container.style.cursor = 'grabbing';

      this.dragPlane.setFromNormalAndCoplanarPoint(
        this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-1),
        this.draggedObject.position
      );

      this.raycaster.setFromCamera(this.mouse, this.camera);
      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.intersectionPoint)) {
        this.dragOffset.subVectors(this.draggedObject.position, this.intersectionPoint);
      }
    }
  }

  private handleDragMove() {
    if (this.isDragging && this.draggedObject) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.intersectionPoint)) {
        const targetPos = new THREE.Vector3().addVectors(this.intersectionPoint, this.dragOffset);
        
        // Back-calculate manualOffset
        // Formula: TargetPos = Original + (Vector * Distance * Value) + ManualOffset
        // So: ManualOffset = TargetPos - (Original + (Vector * Distance * Value))
        
        const explosionEffect = this.draggedObject.userData.explodeVector.clone()
           .multiplyScalar(this.draggedObject.userData.explosionDistance * this.currentExplosionValue);

        const basePos = new THREE.Vector3().addVectors(this.draggedObject.userData.originalPosition, explosionEffect);
        this.draggedObject.userData.manualOffset.subVectors(targetPos, basePos);
        
        this.draggedObject.position.copy(targetPos);
      }
      return;
    }
  }

  private handleDragEnd() {
    if (this.isDragging) {
      this.isDragging = false;
      this.draggedObject = null;
      this.controls.enabled = true;
      this.container.style.cursor = 'crosshair';
    }
  }

  private handleResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public setExplosionFactor(value: number) {
    this.targetExplosionValue = value;
    gsap.to(this, {
      currentExplosionValue: value,
      duration: 0.8,
      ease: "power2.out"
    });
  }
  
  public setModelScale(value: number) {
    this.modelGroup.scale.set(value, value, value);
  }

  public setAutoAnimate(active: boolean) {
    if (this.isAutoAnimating === active) return;
    
    this.isAutoAnimating = active;
    if (this.isAutoAnimating) {
      this.runAutoAnimation();
    } else {
      gsap.killTweensOf(this);
    }
  }

  private runAutoAnimation() {
    if (!this.isAutoAnimating) return;
    const nextValue = this.targetExplosionValue >= 4.9 ? 0 : 5;
    this.targetExplosionValue = nextValue;
    gsap.to(this, {
      currentExplosionValue: nextValue,
      duration: 3,
      ease: "power1.inOut",
      onUpdate: () => {
        this.callbacks.onExplosionUpdate(this.currentExplosionValue);
      },
      onComplete: () => {
        if (this.isAutoAnimating) {
           this.runAutoAnimation();
        }
      }
    });
  }

  private updateMeshes() {
    this.meshes.forEach(mesh => {
      // 1. POSITION UPDATE
      mesh.rotation.copy(mesh.userData.originalRotation);
      
      const targetPos = mesh.userData.originalPosition.clone();

      const explosionVec = mesh.userData.explodeVector.clone()
        .multiplyScalar(mesh.userData.explosionDistance * this.currentExplosionValue);
      
      targetPos.add(explosionVec);

      if (this.explosionMode === 'radial') {
         const rotEffect = this.currentExplosionValue * 0.2;
         mesh.rotation.x += rotEffect * mesh.userData.explodeVector.y;
         mesh.rotation.z += rotEffect * mesh.userData.explodeVector.x;
      }

      targetPos.add(mesh.userData.manualOffset);

      if (this.draggedObject !== mesh) {
         mesh.position.copy(targetPos);
      }
      
      // CRITICAL: Update World Matrix immediately so raycaster uses accurate position for THIS frame
      mesh.updateMatrixWorld();
      
      // 2. STATE VISUALIZATION (HOVER EFFECT)
      // We handle scale and material here every frame based on 'isHovered' flag.
      // This prevents "stuck" states because the loop always drives it to the correct state.
      // Use originalScale to prevent inflating models that have small scales (e.g. 0.01)
      
      const originalScale = mesh.userData.originalScale;
      const targetScalar = mesh.userData.isHovered ? 1.05 : 1.0;
      
      const targetScale = new THREE.Vector3(
        originalScale.x * targetScalar,
        originalScale.y * targetScalar,
        originalScale.z * targetScalar
      );
      
      // Smooth lerp to target scale
      mesh.scale.lerp(targetScale, 0.2);

      // Handle Material Swap
      if (mesh.userData.isHovered && mesh.material !== this.highlightMaterial) {
          mesh.material = this.highlightMaterial;
      } else if (!mesh.userData.isHovered && mesh.material === this.highlightMaterial) {
          // Restore original material if it exists
          if (mesh.userData.originalMaterial) {
             mesh.material = mesh.userData.originalMaterial as THREE.Material | THREE.Material[];
          }
      }
    });
  }

  private checkIntersection() {
    if (this.isDragging) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    // Intersection checks against world coordinates, which were just updated in updateMeshes
    const intersects = this.raycaster.intersectObjects(this.meshes, false);

    if (intersects.length > 0) {
      const hitObject = intersects[0].object as ExplodableMesh;
      
      // Update flags
      let anyHovered = false;
      this.meshes.forEach(mesh => {
        if (mesh === hitObject) {
           mesh.userData.isHovered = true;
           anyHovered = true;
        } else {
           mesh.userData.isHovered = false;
        }
      });
      
      // Update React state if changed
      if (this.currentHoveredName !== hitObject.name) {
         this.currentHoveredName = hitObject.name;
         this.callbacks.onHover(this.currentHoveredName);
      }
      
    } else {
      // No hits - clear all
      let needsUpdate = false;
      this.meshes.forEach(mesh => {
         if (mesh.userData.isHovered) {
           mesh.userData.isHovered = false;
           needsUpdate = true;
         }
      });
      
      if (this.currentHoveredName !== null) {
         this.currentHoveredName = null;
         this.callbacks.onHover(null);
      }
    }
  }

  private startLoop() {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      this.controls.update();
      this.updateMeshes();
      this.checkIntersection();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  public dispose() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
    gsap.killTweensOf(this);
  }
}